import { FileInterface } from "../../../models/file-model";
import { UserInterface } from "../../../models/user-model";

/**
 * Previously created a thumbnail file for videos.
 * Now just return original file.
 */
const createVideoThumbnail = async (
  file: FileInterface,
  filename: string,
  user: UserInterface
): Promise<FileInterface> => {
  return file;
};

export default createVideoThumbnail;
