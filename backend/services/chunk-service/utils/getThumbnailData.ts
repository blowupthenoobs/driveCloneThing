import { EventEmitter } from "stream";
import { Response } from "express";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";

import NotFoundError from "../../../utils/NotFoundError";
import imageChecker from "../../../utils/imageChecker";
import videoChecker from "../../../utils/videoChecker";
import path from "path";
import { getFSStoragePath } from "../../../utils/getFSStoragePath";

const processData = (
  res: Response,
  id: string, //find a way to get this to just be the path string
) => {
  const emitter = new EventEmitter();

  (async () => {
    try {
      const baseDirectory = getFSStoragePath();
      const filePath = path.join(baseDirectory, id);
      
      if (!fs.existsSync(filePath)) {
        console.log("file is not being found rn")
        throw new NotFoundError("File missing on disk");
      }

      /* -------------------------------------------------
       * Image → stream original file
       * ------------------------------------------------- */
      if (imageChecker(filePath)) {
        res.setHeader("Content-Type", "image/jpeg");
        const rs = fs.createReadStream(filePath);
        rs.on("error", e => emitter.emit("uploading thumbnail file had error", e));
        console.log("checked to be an image")
        console.log(filePath)
        rs.pipe(res).on("finish", () => emitter.emit("finish"));
        return;
      }

      /* -------------------------------------------------
       * Video extract single frame
       * ------------------------------------------------- */
      if (videoChecker(filePath)) {
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
  id: string
) =>
  new Promise((resolve, reject) => {
    const e = processData(res, id);
    e.on("finish", resolve);
    e.on("error", reject);
  });

export default getThumbnailData;