// =====================================================
// 业务码常量(与后端 internal/handler/bizcode.go 保持一致)
// 后端用业务码模式,HTTP 状态码恒 200,业务码在 body.code 里
// =====================================================

export const BizCode = Object.freeze({
  Success: 0,

  // 1xxx 鉴权 / 账号 / 角色
  AuthFail: 1001,
  TokenInvalid: 1002,
  TokenMissing: 1003,
  UserNotFound: 1004,
  UserDuplicate: 1005,
  UserPassword: 1006,
  UserNoRole: 1007,
  RoleNotFound: 1008,
  RoleDuplicate: 1009,
  MenuNotFound: 1010,

  // 2xxx 权限
  NoPermission: 2001,

  // 3xxx 文件 / OSS
  UploadInvalid: 3001,
  UploadType: 3002,
  UploadSize: 3003,
  OSSNoConfig: 3004,
  OSSClient: 3005,
  OSSBucket: 3006,
  UploadRead: 3007,
  UploadPut: 3008,

  // 4xxx 参数
  ParamsInvalid: 4001,

  // 9xxx 通用
  Unknown: 9999
})

// 鉴权失败的业务码集合(token 失效 / 缺失)
const AUTH_FAIL_CODES = new Set([BizCode.TokenInvalid, BizCode.TokenMissing])

/**
 * 判断业务码是否表示"需要重新登录"
 * @param {number} code
 * @returns {boolean}
 */
export function isAuthFail(code) {
  return AUTH_FAIL_CODES.has(code)
}
