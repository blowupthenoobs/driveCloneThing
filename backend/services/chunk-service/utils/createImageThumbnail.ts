import { FileInterface } from "../../../models/file-model";
import { UserInterface } from "../../../models/user-model";

/**
 * Previously created a resized thumbnail file on disk.
 * Now we don't want to create a thumbnail file. Return original file object.
 */
const createThumbnail = async (
  file: FileInterface,
  filename: string,
  user: UserInterface
): Promise<FileInterface> => {
  // No-op: just return the file to keep compatibility with callers.
  return file;
};

export default createThumbnail;
