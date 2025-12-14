import { EventEmitter } from "stream";
import { Response } from "express";
import { UserInterface } from "../../../models/user-model";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";

import ThumbnailDB from "../../../db/mongoDB/thumbnailDB";
import FileDB from "../../../db/mongoDB/fileDB";
import NotFoundError from "../../../utils/NotFoundError";
import ForbiddenError from "../../../utils/ForbiddenError";
import imageChecker from "../../../utils/imageChecker";
import videoChecker from "../../../utils/videoChecker";
import { createGenericParams } from "./storageHelper";
import { getStorageActions } from "../actions/helper-actions";

const thumbnailDB = new ThumbnailDB();
const fileDB = new FileDB();
const storageActions = getStorageActions();

const processData = (
  res: Response,
  thumbnailID: string,
  user: UserInterface
) => {
  const eventEmitter = new EventEmitter();

  (async () => {
    try {
      if (!user?._id) throw new ForbiddenError("Invalid user");

      // 1) Try existing thumbnail record (if any)
      const thumbnail = await thumbnailDB.getThumbnailInfo(
        user._id.toString(),
        thumbnailID
      );

      if (thumbnail && thumbnail.path && fs.existsSync(thumbnail.path)) {
        const rs = fs.createReadStream(thumbnail.path);
        rs.on("error", e => eventEmitter.emit("error", e));
        res.on("error", e => eventEmitter.emit("error", e));
        rs.pipe(res).on("finish", () => eventEmitter.emit("finish"));
        return;
      }

      // 2) Fallback to original file (thumbnailID should be file id in many routes)
      // Try to fetch the file using fileDB.getFileInfo (expects fileID, userID)
      const file = await fileDB.getFileInfo(thumbnailID, user._id.toString());
      if (!file) throw new NotFoundError("File Not Found");

      const params = createGenericParams({
        filePath: file.metadata.filePath,
        Key: file.metadata.s3ID,
      });

      const fileStream = storageActions.createReadStream(params);

      // If image => stream original (no change)
      if (imageChecker(file.filename)) {
        res.setHeader("Content-Type", "image/jpeg");
        fileStream.on("error", e => eventEmitter.emit("error", e));
        fileStream.pipe(res).on("finish", () => eventEmitter.emit("finish"));
        return;
      }

      // If video => produce a single-frame JPEG on-the-fly
      if (videoChecker(file.filename)) {
        res.setHeader("Content-Type", "image/jpeg");

        const nodeStream = fileStream as unknown as Readable;

        ffmpeg(nodeStream)
          .inputOptions(["-an"])
          .seekInput(0) // or "1" if you prefer one second in
          .frames(1)
          .outputOptions([
            "-vf",
            "scale=320:320:force_original_aspect_ratio=decrease"
          ])
          .format("image2")
          .on("error", err => eventEmitter.emit("error", err))
          .pipe(res, { end: true })
          .on("finish", () => eventEmitter.emit("finish"));

        return;
      }

      throw new NotFoundError("Thumbnail not available");
    } catch (err) {
      eventEmitter.emit("error", err);
    }
  })();

  return eventEmitter;
};

const getThumbnailData = (res: Response, thumbnailID: string, user: UserInterface) =>
  new Promise((resolve, reject) => {
    const e = processData(res, thumbnailID, user);
    e.on("finish", resolve);
    e.on("error", reject);
  });

export default getThumbnailData;
