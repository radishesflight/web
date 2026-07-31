/**
 * 业务码常量
 *
 * 与后端 `go_server/internal/handler/bizcode.go` 保持一一对应。
 *
 * 后端采用"业务码模式":HTTP 状态码恒为 200,真实状态在 `body.code` 里。
 * 这是国内后台项目的标准做法,优点:
 *   1. 业务码比 HTTP 状态码(400/401/403/500)表达力强
 *   2. 避免浏览器对 4xx 响应的特殊处理(弹 OAuth 框等)
 *   3. 不受网关/中间件改写 HTTP 状态码影响
 *
 * 业务码段位(同步后端):
 *   0     成功
 *   1xxx  鉴权 / 账号 / 角色
 *   2xxx  权限
 *   3xxx  文件 / OSS
 *   4xxx  参数
 *   9xxx  通用 / 未分类
 *
 * 加新业务码的步骤:
 *   1. 后端先加(go_server/internal/handler/bizcode.go)
 *   2. 同步加到这里
 *   3. 业务用得上时 import
 *
 * 单元测试:src/constants/bizcode.test.js
 */

export const BizCode = Object.freeze({
  /** 成功 */
  Success: 0,

  // ===== 1xxx 鉴权 / 账号 / 角色 =====
  /** 令牌生成失败(后端内部错误) */
  AuthFail: 1001,
  /** 令牌无效或已过期 */
  TokenInvalid: 1002,
  /** 未携带令牌 */
  TokenMissing: 1003,
  /** 用户不存在 */
  UserNotFound: 1004,
  /** 用户名已存在 */
  UserDuplicate: 1005,
  /** 密码错误 */
  UserPassword: 1006,
  /** 该用户未分配角色 */
  UserNoRole: 1007,
  /** 角色不存在 */
  RoleNotFound: 1008,
  /** 角色名称已存在 */
  RoleDuplicate: 1009,
  /** 菜单不存在 */
  MenuNotFound: 1010,

  // ===== 2xxx 权限 =====
  /** 无权限(后端 PermissionMiddleware 拦截) */
  NoPermission: 2001,

  // ===== 3xxx 文件 / OSS =====
  /** 请选择要上传的文件 */
  UploadInvalid: 3001,
  /** 不支持的图片格式 */
  UploadType: 3002,
  /** 图片大小超过限制(默认 5MB) */
  UploadSize: 3003,
  /** OSS 未配置(检查 config) */
  OSSNoConfig: 3004,
  /** OSS 客户端创建失败 */
  OSSClient: 3005,
  /** OSS Bucket 获取失败 */
  OSSBucket: 3006,
  /** 文件读取失败 */
  UploadRead: 3007,
  /** 文件上传失败 */
  UploadPut: 3008,

  // ===== 4xxx 参数 =====
  /** 参数错误(通用,适用于所有参数校验失败) */
  ParamsInvalid: 4001,

  // ===== 9xxx 通用 =====
  /** 未分类失败 */
  Unknown: 9999
})

/**
 * 鉴权失败的业务码集合
 * @private
 */
const AUTH_FAIL_CODES = new Set([BizCode.TokenInvalid, BizCode.TokenMissing])

/**
 * 判断业务码是否表示"需要重新登录"
 *
 * 用于 request.js 拦截器判断是否要清 token + 跳 /login
 *
 * @param {number} code 后端返回的 body.code
 * @returns {boolean} true = 鉴权失败,前端要清 token + 跳 login
 */
export function isAuthFail(code) {
  return AUTH_FAIL_CODES.has(code)
}
