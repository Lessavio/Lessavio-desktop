import fs from "fs";
import path from "path";

const dataDirectory = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, "../../data");

function filePath(name: string): string {
  return path.join(dataDirectory, `${name}.json`);
}

export function loadCollection<T>(name: string, revive: (value: unknown) => T): T[] {
  try {
    const content = fs.readFileSync(filePath(name), "utf8");
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) ? parsed.map(revive) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    console.error(`Не удалось прочитать хранилище ${name}:`, error);
    return [];
  }
}

export function saveCollection<T>(name: string, values: T[]): void {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const target = filePath(name);
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(values, null, 2), "utf8");
  fs.renameSync(temporary, target);
}
