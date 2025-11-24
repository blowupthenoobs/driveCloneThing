import { Stream, PassThrough } from "stream";
import { EventEmitter } from "events";
import uuid from "uuid";
import { UserInterface } from "../../../models/user-model";
import File, {
  FileMetadateInterface,
} from "../../../models/file-model";
import env from "../../../enviroment/env";
import { getStorageActions } from "../actions/helper-actions";
import getFileSize from "./getFileSize";
import imageChecker from "../../../utils/imageChecker";
import videoChecker from "../../../utils/videoChecker";
import createVideoThumbnail from "./createVideoThumbnail";
import createThumbnail from "./createImageThumbnail";
import sanitize from "sanitize-filename";
import { getUniqueFileName } from "../../../utils/getUniqueFileName";
import { getFSStoragePath } from "../../../utils/getFSStoragePath";
import { RequestTypeFullUser } from "../../../controllers/file-controller";

const storageActions = getStorageActions();

type FileDataType = {
  name: string;
  size: number;
  type: string;
  path: string;
  index: string;
  file: Stream;
  uploadedFileId?: string;
};

type dataType = Record<string, FileDataType>;

const processData = (
  busboy: any,
  user: UserInterface,
  req: RequestTypeFullUser
) => {
  const eventEmitter = new EventEmitter();

  try {
    const formData = new Map();
    const fileDataMap: dataType = {};

    let parent = "";
    let totalFiles = 0;
    let processed = 0;

    const handleFinish = async (
      filename: string,
      metadata: FileMetadateInterface
    ) => {
      const date = new Date();

      let length = 0;
      if (env.dbType === "fs" && metadata.filePath) {
        length = await getFileSize(metadata.filePath) as number;
      } else {
        length = metadata.size;
      }

      const video = videoChecker(filename);

      const currentFile = new File({
        filename,
        uploadDate: date.toISOString(),
        length,
        metadata: {
          ...metadata,
          isVideo: video,
        },
      });

      await currentFile.save();

      const isImage = imageChecker(filename);

      if (video && env.videoThumbnailsEnabled) {
        return await createVideoThumbnail(currentFile, filename, user);
      }
      if (length < 15728640 && isImage) {
        return await createThumbnail(currentFile, filename, user);
      }

      return currentFile;
    };

    const uploadFile = (
      filename: string,
      fileStream: Stream,
      index: string,
      fileSize: number
    ) => {
      return new Promise<{ filename: string; metadata: FileMetadateInterface }>(
        (resolve, reject) => {
          const sanitizedName = sanitize(filename);

          const metadata = {
            owner: user._id.toString(),
            parent: "/", // TODO: use folder path here
            parentList: ["/"].toString(),
            hasThumbnail: false,
            thumbnailID: "",
            isVideo: false,
            size: fileSize,
            processingFile: true,
          } as FileMetadateInterface;

          const storageDirectory = getFSStoragePath();
          const newName = getUniqueFileName(storageDirectory, sanitizedName);

          metadata.filePath = storageDirectory + "/" + newName;

          // Replace encryption with a no-op stream:
          const pass = new PassThrough();

          const { writeStream } = storageActions.createWriteStream(
            metadata,
            fileStream.pipe(pass),
            sanitizedName
          );

          if (writeStream) {
            fileStream.pipe(writeStream);
          }

          writeStream.on("error", reject);
          fileStream.on("error", reject);

          writeStream.on("finish", () => {
            resolve({ filename, metadata });
          });
        }
      );
    };

    const processQueueItem = async (
      index: string,
      fileData: FileDataType
    ) => {
      const { filename, metadata } = await uploadFile(
        fileData.name,
        fileData.file,
        index,
        fileData.size
      );

      const file = await handleFinish(filename, metadata);

      fileDataMap[index].uploadedFileId = file._id!.toString();

      processed++;

      if (processed === totalFiles) {
        eventEmitter.emit("finish", { fileDataMap, parent });
      }
    };

    busboy.on("field", (field, val) => {
      formData.set(field, val);

      if (field === "file-data") {
        const fd = JSON.parse(val);
        fileDataMap[fd.index] = fd;
      }

      if (field === "total-files") {
        totalFiles = Number(val);
      }

      if (field === "parent") {
        parent = val;
      }
    });

    busboy.on("file", (_: string, file: Stream, fileData: { filename: string }) => {
      const index = fileData.filename;

      if (!fileDataMap[index]) return;

      fileDataMap[index].file = file;

      processQueueItem(index, fileDataMap[index]);
    });

    busboy.on("error", (e: Error) => eventEmitter.emit("error", e));
    req.on("error", (e: Error) => eventEmitter.emit("error", e));

    req.pipe(busboy);
  } catch (e) {
    eventEmitter.emit("error", e);
  }

  return eventEmitter;
};

const getFolderBusboyData = (
  busboy: any,
  user: UserInterface,
  req: RequestTypeFullUser
) => {
  return new Promise<{ fileDataMap: dataType; parent: string }>((resolve, reject) => {
    const emitter = processData(busboy, user, req);

    emitter.on("finish", resolve);
    emitter.on("error", reject);
  });
};

export default getFolderBusboyData;