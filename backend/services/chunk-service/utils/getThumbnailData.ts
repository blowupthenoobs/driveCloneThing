import { EventEmitter } from "stream";
import { Response } from "express";
import { UserInterface } from "../../../models/user-model";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";

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

const processData = (res: Response, thumbnailID: string, user: UserInterface) => {
  const eventEmitter = new EventEmitter();

  (async () => {
    try {
      if (!user?._id) throw new ForbiddenError("Invalid user");

      // ==========================
      // 1. Try thumbnail record
      // ==========================
      const thumbnail = await thumbnailDB.getThumbnailInfo(
        user._id.toString(),
        thumbnailID
      );

      if (thumbnail && thumbnail.path && fs.existsSync(thumbnail.path)) {
        // Image thumbnails still work exactly like before
        const rs = fs.createReadStream(thumbnail.path);

        rs.on("error", (e) => eventEmitter.emit("error", e));
        res.on("error", (e) => eventEmitter.emit("error", e));

        rs.pipe(res).on("finish", () => eventEmitter.emit("finish"));
        return;
      }

      // ====================================
      // 2. Thumbnail missing -> use original file
      // ====================================
      const file = await fileDB.getFileById(thumbnailID);
      if (!file) throw new NotFoundError("File not found");

      if (file.metadata.owner.toString() !== user._id.toString()) {
        throw new ForbiddenError("Not your file");
      }

      const params = createGenericParams({
        filePath: file.metadata.filePath,
        Key: file.metadata.s3ID,
      });

      const fileStream = storageActions.createReadStream(params);

      fileStream.on("error", (e) => eventEmitter.emit("error", e));
      res.on("error", (e) => eventEmitter.emit("error", e));

      // ==========================
      // IMAGE → just stream it
      // ==========================
      if (imageChecker(file.filename)) {
        res.setHeader("Content-Type", "image/jpeg");
        fileStream.pipe(res).on("finish", () => eventEmitter.emit("finish"));
        return;
      }

      // ==========================
      // VIDEO → extract JPEG on the fly
      // ==========================
      if (videoChecker(file.filename)) {
        res.setHeader("Content-Type", "image/jpeg");

        ffmpeg(fileStream)
          .seekInput(1)               // safer than frame 0 for many codecs
          .frames(1)
          .format("image2")
          .outputOptions([
            "-vf scale='320:320:force_original_aspect_ratio=decrease'"
          ])
          .on("error", (err) => {
            console.error("Thumbnail generation error:", err);
            eventEmitter.emit("error", err);
          })
          .pipe(res, { end: true })
          .on("finish", () => eventEmitter.emit("finish"));

        return;
      }

      throw new NotFoundError("Cannot thumbnail this file type");

    } catch (err) {
      eventEmitter.emit("error", err as Error);
    }
  })();

  return eventEmitter;
};

const getThumbnailData = (res: Response, thumbnailID: string, user: UserInterface) => {
  return new Promise((resolve, reject) => {
    const eventEmitter = processData(res, thumbnailID, user);
    eventEmitter.on("finish", resolve);
    eventEmitter.on("error", reject);
  });
};

export default getThumbnailData;
