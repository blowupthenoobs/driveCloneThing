import { useAppDispatch, useAppSelector } from "../../hooks/store";
import CloseIcon from "../../icons/CloseIcon";
import MinimizeIcon from "../../icons/MinimizeIcon";
import { resetUploads } from "../../reducers/uploader";
import { cancelAllFileUploads } from "../../utils/cancelTokenManager";
import UploadItem from "../UploadItem/UploadItem";
import { memo, useMemo, useState } from "react";

const Uploader = memo(() => {
  const [minimized, setMinimized] = useState(false);
  const uploads = useAppSelector((state) => state.uploader.uploads);
  const dispatch = useAppDispatch();

  const toggleMinimize = () => {
    setMinimized((val) => !val);
  };

  const uploadTitle = useMemo(() => {
    const uploadedCount = uploads.filter((upload) => upload.completed).length;
    const currentlyUploadingCount = uploads.filter(
      (upload) => !upload.completed
    ).length;

    if (currentlyUploadingCount) {
      return `Uploading ${currentlyUploadingCount} file${
        currentlyUploadingCount > 1 ? "s" : ""
      }`;
    } else {
      return `Uploaded ${uploadedCount} file${uploadedCount > 1 ? "s" : ""}`;
    }
  }, [uploads]);

  const closeUploader = () => {
    cancelAllFileUploads();
    dispatch(resetUploads());
  };

  return (
    <div className="fixed bottom-0 sm:right-[20px] z-10 bg-bg-grey shadow-lg rounded-t-md w-full sm:w-[315px] text-black">
      <div className="flex flex-row bg-black justify-between p-4 rounded-t-md">
        <p className="text-[#3c85ee]">{uploadTitle}</p>
        <div className="flex flex-row items-center justify-center">
          <a onClick={toggleMinimize}>
            <MinimizeIcon className="w-[24px] h-[24px] text-[#3c85ee] cursor-pointer mr-2" />
          </a>
          <a onClick={closeUploader}>
            <CloseIcon className="w-[24px] h-[24px] text-[#3c85ee]" />
          </a>
        </div>
      </div>
      <div className="overflow-y-scroll animate max-h-[300px]">
        {!minimized &&
          uploads.map((upload) => {
            return <UploadItem key={upload.id} {...upload} />;
          })}
      </div>
    </div>
  );
});

export default Uploader;
