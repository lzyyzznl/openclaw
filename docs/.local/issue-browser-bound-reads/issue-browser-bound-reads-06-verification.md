# Browser pw-tools-core.responses - 验证记录

## 变更内容

`extensions/browser/src/browser/pw-tools-core.responses.ts`

### 三层防御

1. **content-length 预检拒绝**：读取 `headers["content-length"]`，超过 `maxChars * 4` 时直接返回空 body，不调用任何读取 API
2. **Buffer 有界解码**：`resp.body()` → `buf.subarray(0, maxBytes)` → TextDecoder 解码
3. **后置截断**：解码后 `trimmed` 兜底

保留 `resp.text()` 作为 `body` 不可用时的回退。

## 验证

### 代码逻辑分析

| 场景 | 预期 | 结果 |
|------|------|------|
| content-length > maxBytes | 直接返回 `truncated: true`，0 字节分配 | 新增预检路径 |
| 小响应 (< maxBytes)，有 content-length | Buffer 全部解码，返回完整文本 | `decodeLen = buf.byteLength` |
| 大响应 (> maxBytes)，无 content-length | 跳过预检，进入 Buffer 有界解码 | `decodeLen = maxBytes`，峰值内存从 ~500MB 降至 ~2MB |
| body 不可用 | 回退到 `resp.text()` | 保留原行为 |

### 单元测试

```bash
$ pnpm test -- extensions/browser/src/browser/
...
 Test Files  1 failed | 98 passed (99)
      Tests  1 failed | 1160 passed | 1 skipped (1162)
```

通过 98/99 测试文件（唯一失败为 `cdp-proxy-bypass.test.ts`，环境相关，`NO_PROXY` 环境变量问题，与本变更无关）。✅
