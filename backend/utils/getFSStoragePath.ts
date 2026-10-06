import env from "../enviroment/env";

export const getFSStoragePath = () => {
  return env.fsDirectory + "BaseStorage/"
};

export const getFSTrashPath = () => {
  return env.fsTrash;
}
