// backend/services/chunk-service/utils/createImageThumbnail.ts

import Thumbnail from "../../../models/thumbnail-model";
import { FileInterface } from "../../../models/file-model";
import { UserInterface } from "../../../models/user-model";
import { EventEmitter } from "stream";
import FileDB from "../../../db/mongoDB/fileDB";
import { getFSStoragePath } from "../../../utils/getFSStoragePath";

const fileDB = new FileDB();

/**
 * Create a thumbnail entry that references the original file
 * without generating a new image or resizing.
 *
 * This allows the UI to simply load the original encrypted file as the preview.
 */
const processData = (
  file: FileInterface,
  filename: string,
  user: UserInterface
) => {
  const eventEmitter = new EventEmitter();

  (async () => {
    try {
      // ---- No resizing, no encryption, no duplication ----

      const thumbnailModel = new Thumbnail({
        name: filename,
        owner: user._id,
        IV: file.metadata.IV,              // use same IV
        path: file.metadata.filePath,      // SAME file path
        s3ID: file.metadata.s3ID,          // SAME object ID
      });

      await thumbnailModel.save();

      const updatedFile = await fileDB.setThumbnail(
        file._id!.toString(),
        thumbnailModel._id.toString()
      );

      if (!updatedFile) {
        throw new Error("Thumbnail Not Set");
      }

      eventEmitter.emit("finish", updatedFile);
    } catch (e) {
      eventEmitter.emit("error", e);
    }
  })();

  return eventEmitter;
};

const createThumbnail = (
  file: FileInterface,
  filename: string,
  user: UserInterface
) => {
  return new Promise<FileInterface>((resolve, _) => {
    const emitter = processData(file, filename, user);

    emitter.on("error", (e) => {
      console.log("Error creating thumbnail", e);
      resolve(file); // thumbnail failed → still return file
    });

    emitter.on("finish", (updatedFile: FileInterface) => {
      resolve(updatedFile);
    });
  });
};

export default createThumbnail;
