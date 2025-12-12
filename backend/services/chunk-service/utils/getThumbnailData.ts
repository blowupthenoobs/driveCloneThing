import { EventEmitter } from "stream";
import { UserInterface } from "../../../models/user-model";
import { Response } from "express";

import ForbiddenError from "../../../utils/ForbiddenError";
import NotFoundError from "../../../utils/NotFoundError";

import fs from "fs";

import ThumbnailDB from "../../../db/mongoDB/thumbnailDB";

const thumbnailDB = new ThumbnailDB();

const processData = (
  res: Response,
  thumbnailID: string,
  user: UserInterface
) => {
  const eventEmitter = new EventEmitter();

  const processFile = async () => {
    try {
      if (!user?._id) throw new ForbiddenError("Invalid user");

      // Lookup thumbnail metadata
      const thumbnail = await thumbnailDB.getThumbnailInfo(
        user._id.toString(),
        thumbnailID
      );

      if (!thumbnail) throw new NotFoundError("Thumbnail not found");

      const filePath = thumbnail.path;

      if (!filePath || !fs.existsSync(filePath)) {
        throw new NotFoundError("File not found on disk");
      }

      // Stream file back to client
      const readStream = fs.createReadStream(filePath);

      readStream.on("error", (e) => eventEmitter.emit("error", e));
      res.on("error", (e) => eventEmitter.emit("error", e));

      readStream.pipe(res).on("finish", () => {
        eventEmitter.emit("finish");
      });

    } catch (e) {
      eventEmitter.emit("error", e);
    }
  };

  processFile();
  return eventEmitter;
};

const getThumbnailData = (
  res: Response,
  thumbnailID: string,
  user: UserInterface
) => {
  return new Promise((resolve, reject) => {
    const eventEmitter = processData(res, thumbnailID, user);
    eventEmitter.on("finish", resolve);
    eventEmitter.on("error", reject);
  });
};

export default getThumbnailData;
