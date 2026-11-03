// 构建预算：dist 中 JS 总 gzip 体积不超过 30 KB。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
const LIMIT = 30 * 1024;
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const total = walk('dist').filter(f => f.endsWith('.js')).reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0);
console.log(`JS gzip ${(total / 1024).toFixed(1)} KB / ${LIMIT / 1024} KB`);
if (total > LIMIT) process.exit(1);
