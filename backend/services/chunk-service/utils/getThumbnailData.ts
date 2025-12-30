import { EventEmitter } from "stream";
import { Response } from "express";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";

import { UserInterface } from "../../../models/user-model";
import File from "../../../models/file-model";
import ThumbnailDB from "../../../db/mongoDB/thumbnailDB";

import ForbiddenError from "../../../utils/ForbiddenError";
import NotFoundError from "../../../utils/NotFoundError";
import imageChecker from "../../../utils/imageChecker";
import videoChecker from "../../../utils/videoChecker";

const thumbnailDB = new ThumbnailDB();

const processData = (
  res: Response,
  id: string,
  user: UserInterface
) => {
  const emitter = new EventEmitter();

  (async () => {
    try {
      if (!user?._id) {
        throw new ForbiddenError("Invalid user");
      }

      /* -------------------------------------------------
       * Legacy thumbnail lookup
       * ------------------------------------------------- */
      const thumb = await thumbnailDB.getThumbnailInfo(
        user._id.toString(),
        id
      );

      if (thumb?.path && fs.existsSync(thumb.path)) {
        const rs = fs.createReadStream(thumb.path);
        rs.on("error", e => emitter.emit("error", e));
        rs.pipe(res).on("finish", () => emitter.emit("finish"));
        return;
      }

      /* -------------------------------------------------
       * Resolve FILE
       * ------------------------------------------------- */
      let file = await File.findOne({
        _id: id,
        "metadata.owner": user._id.toString(),
      });

      // If ID is actually a thumbnailID, resolve file via metadata
      if (!file) {
        file = await File.findOne({
          "metadata.thumbnailID": id,
          "metadata.owner": user._id.toString(),
        });
      }

      if (!file) {
        throw new NotFoundError("File not found");
      }

      const filePath = file.metadata.filePath;

      if (!filePath || !fs.existsSync(filePath)) {
        throw new NotFoundError("File missing on disk");
      }

      /* -------------------------------------------------
       * Image → stream original file
       * ------------------------------------------------- */
      if (imageChecker(file.filename)) {
        res.setHeader("Content-Type", "image/jpeg");

        const rs = fs.createReadStream(filePath);
        rs.on("error", e => emitter.emit("error", e));
        rs.pipe(res).on("finish", () => emitter.emit("finish"));
        return;
      }

      /* -------------------------------------------------
       * Video extract single frame
       * ------------------------------------------------- */
      if (videoChecker(file.filename)) {
        res.setHeader("Content-Type", "image/jpeg");

        ffmpeg(filePath)
          .inputOptions(["-an"])
          .seekInput(0) // first frame (change to "1" for 1s in)
          .frames(1)
          .outputOptions([
            "-vf scale=320:320:force_original_aspect_ratio=decrease"
          ])
          .format("image2")
          .on("error", e => emitter.emit("error", e))
          .pipe(res, { end: true })
          .on("finish", () => emitter.emit("finish"));

        return;
      }

      throw new NotFoundError("Unsupported file type");
    } catch (err) {
      emitter.emit("error", err);
    }
  })();

  return emitter;
};

const getThumbnailData = (
  res: Response,
  id: string,
  user: UserInterface
) =>
  new Promise((resolve, reject) => {
    const e = processData(res, id, user);
    e.on("finish", resolve);
    e.on("error", reject);
  });

export default getThumbnailData;