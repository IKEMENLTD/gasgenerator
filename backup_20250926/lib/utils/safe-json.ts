/**
 * 安全なJSON処理ユーティリティ
 * プロトタイプ汚染攻撃を防ぐためのJSON解析と操作
 */

import { logger } from './logger'

export class SafeJSON {
  // 危険なプロパティ名のブラックリスト
  private static readonly DANGEROUS_KEYS = [
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString'
  ]

  // 最大ネスト深度
  private static readonly MAX_DEPTH = 10

  /**
   * 安全なJSON解析
   */
  static parse<T = any>(
    text: string,
    options: {
      maxDepth?: number
      allowedKeys?: string[]
      reviver?: (key: string, value: any) => any
    } = {}
  ): T {
    const { maxDepth = this.MAX_DEPTH, allowedKeys, reviver } = options

    try {
      // 基本的なJSON解析
      const parsed = JSON.parse(text, reviver)
      
      // プロトタイプ汚染チェック
      this.validateObject(parsed, maxDepth, allowedKeys)
      
      return parsed as T
    } catch (error) {
      logger.error('Failed to parse JSON safely', { error })
      throw new Error('Invalid JSON data')
    }
  }

  /**
   * 安全なJSON文字列化
   */
  static stringify(
    value: any,
    replacer?: (key: string, value: any) => any,
    space?: string | number
  ): string {
    // 危険なプロパティを除外するreplacer
    const safeReplacer = (key: string, val: any) => {
      if (this.isDangerousKey(key)) {
        return undefined
      }
      
      if (replacer) {
        return replacer(key, val)
      }
      
      return val
    }

    return JSON.stringify(value, safeReplacer, space)
  }

  /**
   * オブジェクトの安全な深いマージ
   */
  static deepMerge<T extends Record<string, any>>(
    target: T,
    source: any,
    options: {
      maxDepth?: number
      overwrite?: boolean
    } = {}
  ): T {
    const { maxDepth = this.MAX_DEPTH, overwrite = true } = options
    
    // ソースの検証
    this.validateObject(source, maxDepth)
    
    return this.mergeRecursive(target, source, overwrite, 0, maxDepth)
  }

  /**
   * オブジェクトの安全なクローン
   */
  static deepClone<T>(obj: T, maxDepth: number = this.MAX_DEPTH): T {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any
    }

    if (obj instanceof Array) {
      const clonedArr: any[] = []
      for (let i = 0; i < obj.length; i++) {
        clonedArr[i] = this.deepClone(obj[i], maxDepth - 1)
      }
      return clonedArr as any
    }

    if (obj instanceof Object) {
      const clonedObj: any = {}
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && !this.isDangerousKey(key)) {
          clonedObj[key] = this.deepClone(obj[key], maxDepth - 1)
        }
      }
      return clonedObj
    }

    return obj
  }

  /**
   * オブジェクトの検証
   */
  private static validateObject(
    obj: any,
    maxDepth: number,
    allowedKeys?: string[],
    currentDepth: number = 0
  ): void {
    // 深度チェック
    if (currentDepth > maxDepth) {
      throw new Error(`Object depth exceeds maximum allowed depth of ${maxDepth}`)
    }

    // nullやプリミティブ型は安全
    if (obj === null || typeof obj !== 'object') {
      return
    }

    // 配列の各要素を検証
    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.validateObject(item, maxDepth, allowedKeys, currentDepth + 1)
      }
      return
    }

    // オブジェクトのキーを検証
    for (const key in obj) {
      // プロトタイプチェーンのプロパティは無視
      if (!obj.hasOwnProperty(key)) {
        continue
      }

      // 危険なキーのチェック
      if (this.isDangerousKey(key)) {
        throw new Error(`Dangerous key detected: ${key}`)
      }

      // 許可リストがある場合のチェック
      if (allowedKeys && !allowedKeys.includes(key)) {
        throw new Error(`Key not in allowed list: ${key}`)
      }

      // 再帰的に検証
      this.validateObject(obj[key], maxDepth, allowedKeys, currentDepth + 1)
    }
  }

  /**
   * 危険なキーかチェック
   */
  private static isDangerousKey(key: string): boolean {
    // 大文字小文字を無視してチェック
    const lowerKey = key.toLowerCase()
    return this.DANGEROUS_KEYS.some(dangerous => 
      lowerKey === dangerous.toLowerCase()
    )
  }

  /**
   * 再帰的マージ
   */
  private static mergeRecursive(
    target: any,
    source: any,
    overwrite: boolean,
    depth: number,
    maxDepth: number
  ): any {
    if (depth > maxDepth) {
      throw new Error(`Merge depth exceeds maximum allowed depth of ${maxDepth}`)
    }

    // ソースがnullまたはプリミティブ型の場合
    if (source === null || typeof source !== 'object') {
      return overwrite ? source : target
    }

    // ターゲットがオブジェクトでない場合
    if (typeof target !== 'object' || target === null) {
      target = Array.isArray(source) ? [] : {}
    }

    // 配列の場合
    if (Array.isArray(source)) {
      if (!Array.isArray(target)) {
        target = []
      }
      
      if (overwrite) {
        target = [...source]
      } else {
        target = [...target, ...source]
      }
      
      return target
    }

    // オブジェクトの場合
    for (const key in source) {
      if (!source.hasOwnProperty(key) || this.isDangerousKey(key)) {
        continue
      }

      const sourceValue = source[key]
      const targetValue = target[key]

      if (typeof sourceValue === 'object' && sourceValue !== null) {
        target[key] = this.mergeRecursive(
          targetValue,
          sourceValue,
          overwrite,
          depth + 1,
          maxDepth
        )
      } else if (overwrite || !(key in target)) {
        target[key] = sourceValue
      }
    }

    return target
  }

  /**
   * 安全なプロパティアクセス
   */
  static get<T = any>(
    obj: any,
    path: string,
    defaultValue?: T
  ): T | undefined {
    // パスの検証
    if (typeof path !== 'string' || path.includes('__proto__')) {
      return defaultValue
    }

    const keys = path.split('.')
    let current = obj

    for (const key of keys) {
      if (this.isDangerousKey(key)) {
        return defaultValue
      }

      if (current === null || current === undefined) {
        return defaultValue
      }

      current = current[key]
    }

    return current !== undefined ? current : defaultValue
  }

  /**
   * 安全なプロパティ設定
   */
  static set(
    obj: any,
    path: string,
    value: any
  ): boolean {
    // パスの検証
    if (typeof path !== 'string' || path.includes('__proto__')) {
      return false
    }

    const keys = path.split('.')
    const lastKey = keys.pop()

    if (!lastKey || this.isDangerousKey(lastKey)) {
      return false
    }

    let current = obj

    for (const key of keys) {
      if (this.isDangerousKey(key)) {
        return false
      }

      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {}
      }

      current = current[key]
    }

    current[lastKey] = value
    return true
  }

  /**
   * オブジェクトのサニタイズ
   */
  static sanitize<T extends Record<string, any>>(
    obj: T,
    options: {
      removeNull?: boolean
      removeUndefined?: boolean
      removeEmpty?: boolean
      maxDepth?: number
    } = {}
  ): Partial<T> {
    const {
      removeNull = false,
      removeUndefined = true,
      removeEmpty = false,
      maxDepth = this.MAX_DEPTH
    } = options

    const sanitized: any = {}

    for (const key in obj) {
      if (!obj.hasOwnProperty(key) || this.isDangerousKey(key)) {
        continue
      }

      const value = obj[key]

      // フィルタリング条件
      if (removeUndefined && value === undefined) continue
      if (removeNull && value === null) continue
      if (removeEmpty && value === '') continue
      if (removeEmpty && Array.isArray(value) && value.length === 0) continue
      if (removeEmpty && typeof value === 'object' && value !== null && Object.keys(value).length === 0) continue

      // 再帰的サニタイズ
      if (typeof value === 'object' && value !== null && maxDepth > 0) {
        sanitized[key] = this.sanitize(value, {
          ...options,
          maxDepth: maxDepth - 1
        })
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }
}

/**
 * 安全なJSONパースのヘルパー関数
 */
export function safeJSONParse<T = any>(
  text: string,
  defaultValue?: T
): T | undefined {
  try {
    return SafeJSON.parse<T>(text)
  } catch {
    return defaultValue
  }
}

/**
 * 安全なオブジェクトマージのヘルパー関数
 */
export function safeMerge<T extends Record<string, any>>(
  target: T,
  ...sources: any[]
): T {
  let result = target

  for (const source of sources) {
    result = SafeJSON.deepMerge(result, source)
  }

  return result
}