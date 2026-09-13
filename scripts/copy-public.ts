// Copies static assets into the build output. Cloudflare Pages serves dist/public.
import { cpSync } from "node:fs";

cpSync("public", "dist/public", { recursive: true });
