/**
 * セキュアなデータベースクエリビルダー
 * SQLインジェクション対策とパラメータ化クエリの実装
 */

import { logger } from '@/lib/utils/logger'
import { InputValidator } from '@/lib/utils/input-validator'

export interface QueryParams {
  table: string
  columns?: string[]
  where?: Record<string, any>
  orderBy?: { column: string; direction: 'ASC' | 'DESC' }[]
  limit?: number
  offset?: number
  joins?: JoinClause[]
  groupBy?: string[]
  having?: Record<string, any>
}

interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  table: string
  on: { left: string; operator: string; right: string }
}

interface PreparedQuery {
  sql: string
  params: any[]
  paramTypes?: string[]
}

export class QueryBuilder {
  private static readonly ALLOWED_OPERATORS = [
    '=', '!=', '<>', '<', '<=', '>', '>=',
    'LIKE', 'NOT LIKE', 'IN', 'NOT IN',
    'IS NULL', 'IS NOT NULL', 'BETWEEN'
  ]

  private static readonly RESERVED_WORDS = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP',
    'CREATE', 'ALTER', 'EXEC', 'EXECUTE', 'UNION'
  ]

  /**
   * SELECT文の構築
   */
  static buildSelect(params: QueryParams): PreparedQuery {
    this.validateTableName(params.table)
    
    const parts: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    // SELECT句
    const columns = params.columns && params.columns.length > 0
      ? params.columns.map(c => this.escapeIdentifier(c)).join(', ')
      : '*'
    parts.push(`SELECT ${columns}`)

    // FROM句
    parts.push(`FROM ${this.escapeIdentifier(params.table)}`)

    // JOIN句
    if (params.joins) {
      for (const join of params.joins) {
        this.validateTableName(join.table)
        parts.push(
          `${join.type} JOIN ${this.escapeIdentifier(join.table)} ` +
          `ON ${this.escapeIdentifier(join.on.left)} ${join.on.operator} ${this.escapeIdentifier(join.on.right)}`
        )
      }
    }

    // WHERE句
    if (params.where && Object.keys(params.where).length > 0) {
      const whereConditions = this.buildWhereClause(params.where, queryParams, paramIndex)
      if (whereConditions) {
        parts.push(`WHERE ${whereConditions.sql}`)
        paramIndex = whereConditions.nextIndex
      }
    }

    // GROUP BY句
    if (params.groupBy && params.groupBy.length > 0) {
      const groupColumns = params.groupBy.map(c => this.escapeIdentifier(c)).join(', ')
      parts.push(`GROUP BY ${groupColumns}`)
    }

    // HAVING句
    if (params.having && Object.keys(params.having).length > 0) {
      const havingConditions = this.buildWhereClause(params.having, queryParams, paramIndex)
      if (havingConditions) {
        parts.push(`HAVING ${havingConditions.sql}`)
        paramIndex = havingConditions.nextIndex
      }
    }

    // ORDER BY句
    if (params.orderBy && params.orderBy.length > 0) {
      const orderClauses = params.orderBy.map(o => 
        `${this.escapeIdentifier(o.column)} ${o.direction}`
      ).join(', ')
      parts.push(`ORDER BY ${orderClauses}`)
    }

    // LIMIT/OFFSET句
    if (params.limit) {
      parts.push(`LIMIT $${paramIndex}`)
      queryParams.push(params.limit)
      paramIndex++
    }

    if (params.offset) {
      parts.push(`OFFSET $${paramIndex}`)
      queryParams.push(params.offset)
      paramIndex++
    }

    const sql = parts.join(' ')
    
    logger.debug('Query built', { 
      sql, 
      paramCount: queryParams.length,
      table: params.table 
    })

    return { sql, params: queryParams }
  }

  /**
   * INSERT文の構築
   */
  static buildInsert(
    table: string,
    data: Record<string, any>,
    returning?: string[]
  ): PreparedQuery {
    this.validateTableName(table)
    
    const columns: string[] = []
    const values: string[] = []
    const params: any[] = []

    let paramIndex = 1
    for (const [key, value] of Object.entries(data)) {
      this.validateColumnName(key)
      columns.push(this.escapeIdentifier(key))
      values.push(`$${paramIndex}`)
      params.push(this.sanitizeValue(value))
      paramIndex++
    }

    let sql = `INSERT INTO ${this.escapeIdentifier(table)} (${columns.join(', ')}) ` +
              `VALUES (${values.join(', ')})`

    if (returning && returning.length > 0) {
      const returningColumns = returning.map(c => this.escapeIdentifier(c)).join(', ')
      sql += ` RETURNING ${returningColumns}`
    }

    return { sql, params }
  }

  /**
   * UPDATE文の構築
   */
  static buildUpdate(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>,
    returning?: string[]
  ): PreparedQuery {
    this.validateTableName(table)
    
    const setParts: string[] = []
    const params: any[] = []
    let paramIndex = 1

    // SET句
    for (const [key, value] of Object.entries(data)) {
      this.validateColumnName(key)
      setParts.push(`${this.escapeIdentifier(key)} = $${paramIndex}`)
      params.push(this.sanitizeValue(value))
      paramIndex++
    }

    let sql = `UPDATE ${this.escapeIdentifier(table)} SET ${setParts.join(', ')}`

    // WHERE句
    const whereConditions = this.buildWhereClause(where, params, paramIndex)
    if (whereConditions) {
      sql += ` WHERE ${whereConditions.sql}`
      paramIndex = whereConditions.nextIndex
    }

    // RETURNING句
    if (returning && returning.length > 0) {
      const returningColumns = returning.map(c => this.escapeIdentifier(c)).join(', ')
      sql += ` RETURNING ${returningColumns}`
    }

    return { sql, params }
  }

  /**
   * DELETE文の構築
   */
  static buildDelete(
    table: string,
    where: Record<string, any>,
    returning?: string[]
  ): PreparedQuery {
    this.validateTableName(table)
    
    const params: any[] = []
    let sql = `DELETE FROM ${this.escapeIdentifier(table)}`

    // WHERE句（必須）
    if (!where || Object.keys(where).length === 0) {
      throw new Error('DELETE without WHERE clause is not allowed')
    }

    const whereConditions = this.buildWhereClause(where, params, 1)
    if (whereConditions) {
      sql += ` WHERE ${whereConditions.sql}`
    }

    // RETURNING句
    if (returning && returning.length > 0) {
      const returningColumns = returning.map(c => this.escapeIdentifier(c)).join(', ')
      sql += ` RETURNING ${returningColumns}`
    }

    return { sql, params }
  }

  /**
   * WHERE句の構築
   */
  private static buildWhereClause(
    conditions: Record<string, any>,
    params: any[],
    startIndex: number
  ): { sql: string; nextIndex: number } | null {
    const parts: string[] = []
    let paramIndex = startIndex

    for (const [key, value] of Object.entries(conditions)) {
      // 複雑な条件の処理
      if (key === '$or' && Array.isArray(value)) {
        const orParts: string[] = []
        for (const orCondition of value) {
          const subCondition = this.buildWhereClause(orCondition, params, paramIndex)
          if (subCondition) {
            orParts.push(`(${subCondition.sql})`)
            paramIndex = subCondition.nextIndex
          }
        }
        if (orParts.length > 0) {
          parts.push(`(${orParts.join(' OR ')})`)
        }
      } else if (key === '$and' && Array.isArray(value)) {
        const andParts: string[] = []
        for (const andCondition of value) {
          const subCondition = this.buildWhereClause(andCondition, params, paramIndex)
          if (subCondition) {
            andParts.push(`(${subCondition.sql})`)
            paramIndex = subCondition.nextIndex
          }
        }
        if (andParts.length > 0) {
          parts.push(`(${andParts.join(' AND ')})`)
        }
      } else {
        // 通常の条件
        this.validateColumnName(key)
        const column = this.escapeIdentifier(key)

        if (value === null) {
          parts.push(`${column} IS NULL`)
        } else if (value === undefined) {
          // Skip undefined values
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          // オペレーター付き条件
          for (const [op, val] of Object.entries(value)) {
            const operator = this.getOperator(op)
            if (operator === 'IN' || operator === 'NOT IN') {
              if (Array.isArray(val)) {
                const placeholders = val.map(() => {
                  params.push(this.sanitizeValue(val))
                  return `$${paramIndex++}`
                }).join(', ')
                parts.push(`${column} ${operator} (${placeholders})`)
              }
            } else if (operator === 'BETWEEN') {
              if (Array.isArray(val) && val.length === 2) {
                parts.push(`${column} BETWEEN $${paramIndex} AND $${paramIndex + 1}`)
                params.push(this.sanitizeValue(val[0]))
                params.push(this.sanitizeValue(val[1]))
                paramIndex += 2
              }
            } else {
              parts.push(`${column} ${operator} $${paramIndex}`)
              params.push(this.sanitizeValue(val))
              paramIndex++
            }
          }
        } else if (Array.isArray(value)) {
          // IN句
          const placeholders = value.map((v) => {
            params.push(this.sanitizeValue(v))
            return `$${paramIndex++}`
          }).join(', ')
          parts.push(`${column} IN (${placeholders})`)
        } else {
          // 単純な等価条件
          parts.push(`${column} = $${paramIndex}`)
          params.push(this.sanitizeValue(value))
          paramIndex++
        }
      }
    }

    if (parts.length === 0) return null

    return {
      sql: parts.join(' AND '),
      nextIndex: paramIndex
    }
  }

  /**
   * テーブル名の検証
   */
  private static validateTableName(table: string): void {
    if (!table || typeof table !== 'string') {
      throw new Error('Invalid table name')
    }

    // 長さ制限
    if (table.length > 64) {
      throw new Error('Table name too long')
    }

    // 文字制限（英数字とアンダースコアのみ）
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      throw new Error('Invalid table name format')
    }

    // 予約語チェック
    if (this.RESERVED_WORDS.includes(table.toUpperCase())) {
      throw new Error('Table name is a reserved word')
    }
  }

  /**
   * カラム名の検証
   */
  private static validateColumnName(column: string): void {
    if (!column || typeof column !== 'string') {
      throw new Error('Invalid column name')
    }

    // 長さ制限
    if (column.length > 64) {
      throw new Error('Column name too long')
    }

    // 文字制限（英数字、アンダースコア、ドット許可）
    if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(column)) {
      throw new Error('Invalid column name format')
    }

    // SQLインジェクション文字列チェック
    if (InputValidator.detectSQLInjection(column)) {
      throw new Error('Potential SQL injection detected in column name')
    }
  }

  /**
   * 識別子のエスケープ
   */
  private static escapeIdentifier(identifier: string): string {
    // PostgreSQL用のエスケープ（ダブルクォート）
    return `"${identifier.replace(/"/g, '""')}"`
  }

  /**
   * 値のサニタイズ
   */
  private static sanitizeValue(value: any): any {
    if (value === null || value === undefined) {
      return null
    }

    if (typeof value === 'string') {
      // 長さ制限
      if (value.length > 10000) {
        logger.warn('Value truncated due to length', { 
          originalLength: value.length 
        })
        value = value.substring(0, 10000)
      }

      // SQLインジェクションチェック
      if (InputValidator.detectSQLInjection(value)) {
        logger.warn('Potential SQL injection in value', { 
          value: value.substring(0, 100) 
        })
        // 危険な文字をエスケープ
        value = value.replace(/['";\\]/g, '')
      }
    }

    return value
  }

  /**
   * オペレーターの取得と検証
   */
  private static getOperator(op: string): string {
    const operatorMap: Record<string, string> = {
      '$eq': '=',
      '$ne': '!=',
      '$lt': '<',
      '$lte': '<=',
      '$gt': '>',
      '$gte': '>=',
      '$like': 'LIKE',
      '$notLike': 'NOT LIKE',
      '$in': 'IN',
      '$notIn': 'NOT IN',
      '$isNull': 'IS NULL',
      '$isNotNull': 'IS NOT NULL',
      '$between': 'BETWEEN'
    }

    const operator = operatorMap[op] || op.toUpperCase()

    if (!this.ALLOWED_OPERATORS.includes(operator)) {
      throw new Error(`Invalid operator: ${op}`)
    }

    return operator
  }

  /**
   * バルクインサートの構築
   */
  static buildBulkInsert(
    table: string,
    records: Record<string, any>[],
    returning?: string[]
  ): PreparedQuery {
    if (!records || records.length === 0) {
      throw new Error('No records to insert')
    }

    this.validateTableName(table)

    // カラム名の取得（最初のレコードから）
    const columns = Object.keys(records[0])
    columns.forEach(col => this.validateColumnName(col))

    const params: any[] = []
    const valueGroups: string[] = []
    let paramIndex = 1

    for (const record of records) {
      const values: string[] = []
      for (const column of columns) {
        values.push(`$${paramIndex}`)
        params.push(this.sanitizeValue(record[column]))
        paramIndex++
      }
      valueGroups.push(`(${values.join(', ')})`)
    }

    const columnList = columns.map(c => this.escapeIdentifier(c)).join(', ')
    let sql = `INSERT INTO ${this.escapeIdentifier(table)} (${columnList}) ` +
              `VALUES ${valueGroups.join(', ')}`

    if (returning && returning.length > 0) {
      const returningColumns = returning.map(c => this.escapeIdentifier(c)).join(', ')
      sql += ` RETURNING ${returningColumns}`
    }

    return { sql, params }
  }

  /**
   * トランザクション用クエリの構築
   */
  static buildTransaction(queries: PreparedQuery[]): PreparedQuery[] {
    return [
      { sql: 'BEGIN', params: [] },
      ...queries,
      { sql: 'COMMIT', params: [] }
    ]
  }
}

/**
 * クエリ実行のヘルパー関数
 */
export async function executeQuery<T = any>(
  client: any, // Supabase/PostgreSQLクライアント
  query: PreparedQuery
): Promise<T[]> {
  try {
    logger.debug('Executing query', { 
      sql: query.sql.substring(0, 200),
      paramCount: query.params.length 
    })

    const result = await client.query(query.sql, query.params)
    return result.rows || []
  } catch (error) {
    logger.error('Query execution failed', { 
      error,
      query: query.sql.substring(0, 200) 
    })
    throw error
  }
}