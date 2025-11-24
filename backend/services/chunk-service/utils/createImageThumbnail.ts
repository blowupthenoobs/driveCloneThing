import Thumbnail from "../../../models/thumbnail-model";
import { FileInterface } from "../../../models/file-model";
import { UserInterface } from "../../../models/user-model";
import { EventEmitter } from "stream";
import FileDB from "../../../db/mongoDB/fileDB";
const fileDB = new FileDB();


const processData = async (
  file: FileInterface,
  filename: string,
  user: UserInterface
) => {
  const eventEmitter = new EventEmitter();

  try {
    const thumbnailModel = new Thumbnail({
      name: filename,
      owner: user._id,
      IV: file.metadata.IV,
      path: file.metadata.filePath,
      s3ID: file.metadata.s3ID,
      originalFile: file._id
    })

    await thumbnailModel.save();

    const updatedFile = await fileDB.setThumbnail(
      file._id!.toString(),
      thumbnailModel._id.toString()
    );

    if(!updatedFile) {
      throw new Error("Thumbnail not set");
    }

    eventEmitter.emit("finish", updatedFile);
  } catch (e) {
    eventEmitter.emit("error", e);
  }

  return eventEmitter;
};

const createThumbnail = (
  file: FileInterface,
  filename: string,
  user: UserInterface
) => {
  return new Promise<FileInterface>((resolve, _) => {
    const eventEmitter = processData(file, filename, user);
    eventEmitter.on("error", (e) => {
      console.log("Error creating thumbnail", e);
      resolve(file);
    });
    eventEmitter.on("finish", (updatedFile: FileInterface) => {
      resolve(updatedFile);
    });
  });
};

export default createThumbnail;
