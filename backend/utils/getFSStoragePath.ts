import env from "../enviroment/env";

export const getFSStoragePath = () => {
  console.log("the initial env.fsDirectory is : ", env.fsDirectory);
  return env.fsDirectory;
};

export const getFSTrashPath = () => {
  console.log("the initial env.fsTrash is : ", env.fsTrash);
  return env.fsTrash;
}
