import { FileInterface } from "../../../models/file-model";
import { UserInterface } from "../../../models/user-model";
import File from "../../../models/file-model";
import { ObjectId } from "mongodb";

/**
 * Instead of generating a thumbnail file,
 * this version simply marks the original video as having a thumbnail
 * and points thumbnailID to itself.
 */
const createVideoThumbnail = async (
  file: FileInterface,
  filename: string,
  user: UserInterface
): Promise<FileInterface> => {
  try {
    if (!file._id) return file;

    // Update metadata to indicate the thumbnail = original file
    const update = await File.updateOne(
      {
        _id: new ObjectId(file._id),
        "metadata.owner": user._id,
      },
      {
        $set: {
          "metadata.hasThumbnail": true,
          "metadata.thumbnailID": file._id, // link to itself
          "metadata.isVideo": true,
        },
      }
    );

    if (update.modifiedCount === 0) {
      // nothing updated — return original
      return file;
    }

    const updatedFile = await File.findById({
      _id: new ObjectId(file._id),
      "metadata.owner": user._id,
    });

    return updatedFile ? updatedFile.toObject() : file;
  } catch (e) {
    console.error("Video thumbnail update failed:", e);
    return file;
  }
};

export default createVideoThumbnail;
