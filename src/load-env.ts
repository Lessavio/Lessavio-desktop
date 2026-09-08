import path from "path";
import dotenv from "dotenv";

const rootDirectory = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(rootDirectory, ".env.local"), quiet: true });
dotenv.config({ path: path.join(rootDirectory, ".env"), quiet: true });
