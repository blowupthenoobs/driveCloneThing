import fs from "fs";
import path from "path";

export function getUniqueFileName(directory: string, originalName: string): string {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);

    let safeName = originalName;
    let counter = 0;

    while(fs.existsSync(path.join(directory, safeName)))
    {
        safeName = `${name}(${counter})${ext}`
        counter++
    }

    return safeName;
}