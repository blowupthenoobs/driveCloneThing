import { EventEmitter, Stream } from "stream";
import { UserInterface } from "../../../models/user-model";
import File, {
  FileInterface,
  FileMetadateInterface,
} from "../../../models/file-model";
import sanitize from "sanitize-filename";
import { getUniqueFileName } from "../../../utils/getUniqueFileName";
import { getFSStoragePath } from "../../../utils/getFSStoragePath";
import getFileSize from "./getFileSize";
import imageChecker from "../../../utils/imageChecker";
import videoChecker from "../../../utils/videoChecker";
import createVideoThumbnail from "./createVideoThumbnail";
import createThumbnail from "./createImageThumbnail";
import { RequestTypeFullUser } from "../../../controllers/file-controller";
import ForbiddenError from "../../../utils/ForbiddenError";

type FileInfo = {
  file: FileInterface;
  parent: string;
};

const saveToDisk = (
  fileStream: Stream,
  fullPath: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const fs = require("fs");
    const writeStream = fs.createWriteStream(fullPath);

    fileStream.pipe(writeStream);

    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    fileStream.on("error", reject);
  });
};

const handleUpload = async (
  user: UserInterface,
  filename: string,
  fileStream: Stream,
  parent: string,
  size: number
) => {
  const date = new Date();
  const cleanName = sanitize(filename);

  const storageDirectory = getFSStoragePath();
  const finalFileName = getUniqueFileName(storageDirectory, cleanName);
  const fullPath = storageDirectory + finalFileName;

  const metadata: FileMetadateInterface = {
    owner: user._id.toString(),
    parent,
    parentList: [parent].toString(),
    hasThumbnail: false,      // ← keep false
    thumbnailID: "",          // ← keep empty
    isVideo: videoChecker(cleanName),
    size,
    filePath: fullPath,
    processingFile: true,
  };

  // Save file to disk
  await saveToDisk(fileStream, fullPath);

  // Update size after write
  metadata.size = await getFileSize(fullPath);

  const fileDoc = new File({
    filename: cleanName,
    uploadDate: date.toISOString(),
    length: metadata.size,
    metadata,
  });

  await fileDoc.save();

  // 🚫 NO thumbnail creation here anymore
  return fileDoc;
};


const processBusboy = (
  busboy: any,
  user: UserInterface,
  req: RequestTypeFullUser
) => {
  const emitter = new EventEmitter();

  let parent = "/";
  let size = 0;

  busboy.on("field", (field: string, val: any) => {
    if (field === "parent") parent = val;
    if (field === "size") size = +val;
  });

  busboy.on(
    "file",
    async (_: string, file: Stream, data: { filename: string }) => {
      try {
        const fileDoc = await handleUpload(
          user,
          data.filename,
          file,
          parent,
          size
        );

        emitter.emit("finish", { file: fileDoc, parent });
      } catch (err) {
        emitter.emit("error", err);
      }
    }
  );

  busboy.on("error", (e: Error) => emitter.emit("error", e));
  req.on("error", (e: Error) => emitter.emit("error", e));

  req.pipe(busboy);

  return emitter;
};

const uploadFileToStorage = (
  busboy: any,
  user: UserInterface,
  req: RequestTypeFullUser
): Promise<FileInfo> => {
  return new Promise((resolve, reject) => {
    const emitter = processBusboy(busboy, user, req);

    emitter.on("finish", resolve);
    emitter.on("error", reject);
  });
};

export default uploadFileToStorage;
