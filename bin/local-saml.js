#!/usr/bin/env bun
import { join } from "path";
await import(join(import.meta.dir, "../server.ts"));
