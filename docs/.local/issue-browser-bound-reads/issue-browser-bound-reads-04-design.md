# Browser pw-tools-core.responses - 修复方案

## 变更清单

| 文件 | 行 | 修改 |
|------|-----|------|
| `extensions/browser/src/browser/pw-tools-core.responses.ts` | 90-101 | 新增 content-length 预检拒绝 |
| `extensions/browser/src/browser/pw-tools-core.responses.ts` | 106-117 | `resp.text()` → `resp.body()` + 有界解码 |

## 修改策略

### 三层防御

1. **content-length 预检拒绝**（新增）：
   ```
   headers["content-length"] > maxChars * 4 → 直接返回 body: "", truncated: true
   ```
   在调用 `resp.body()` 之前，通过响应头 `content-length` 判断 body 大小。超过阈值时立即返回空 body，完全不分配内存。

2. **Buffer 有界解码**（主路径）：
   ```
   resp.body() → Buffer → Math.min(byteLength, maxBytes) → 解码 → slice(maxChars)
   ```
   `resp.body()` 返回 Buffer，通过 `buf.subarray(0, maxBytes)` 限制解码窗口。`maxBytes = maxChars * 4` 即 UTF-8 最坏情况（4 字节/字符），保证解码后至少有 maxChars 个字符。

3. **后置截断**（兜底）：
   解码后通过 `trimmed` 截断处理超量字符。

### 保留 `resp.text()` 回退

当 `resp.body` 不可用时（Playwright 旧版本），回退到 `resp.text()` 保持兼容性。

## 风险

- `content-length` 头并非所有响应都携带（Transfer-Encoding: chunked 无 content-length），此时跳过预检，走 Buffer 有界解码路径
- Playwright 的 `body()` 仍然缓冲完整响应体，ByteBuffer 分配不可跳过；但避免了完整字符串解码
- 真正有界捕获需要 CDP 级别流式读取（`Fetch.takeResponseBodyAsStream`），当前为 ponytail 级别简化方案
- `buf.subarray()` 创建视图而非拷贝，零额外开销

## 测试策略

无现有 UT 直接覆盖该函数，修改后通过 `pnpm test -- extensions/browser/src/browser/` 确认无回归。
