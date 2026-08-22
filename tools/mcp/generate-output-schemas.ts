import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'

import { mcpEligibilityManifest } from '../../server/application/operations/eligibility-manifest'

type JsonSchema = boolean | Record<string, unknown>

function operationId(call: ts.CallExpression) {
  const definition = call.arguments[0]
  if (!definition || !ts.isObjectLiteralExpression(definition)) return undefined
  const property = definition.properties.find(node => ts.isPropertyAssignment(node) && node.name.getText() === 'id')
  if (!property || !ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.initializer)) return undefined
  return property.initializer.text
}

function typeSchema(checker: ts.TypeChecker, type: ts.Type, location: ts.Node, seen = new Set<number>()): JsonSchema {
  if (type.flags & ts.TypeFlags.Any || type.flags & ts.TypeFlags.Unknown) {
    throw new Error(`Unconstrained output type: ${checker.typeToString(type, location)}`)
  }
  if (type.flags & ts.TypeFlags.Never) return false
  if (type.flags & ts.TypeFlags.String) return { type: 'string' }
  if (type.flags & ts.TypeFlags.Number) return { type: 'number' }
  if (type.flags & ts.TypeFlags.Boolean) return { type: 'boolean' }
  if (type.flags & ts.TypeFlags.Null) return { type: 'null' }
  if (type.flags & ts.TypeFlags.Undefined || type.flags & ts.TypeFlags.Void) return { not: {} }
  if (type.isStringLiteral()) return { const: type.value }
  if (type.isNumberLiteral()) return { const: type.value }
  if (type.flags & ts.TypeFlags.BooleanLiteral) return { const: checker.typeToString(type) === 'true' }

  if (type.isUnion()) {
    const variants = type.types.filter(member => !(member.flags & ts.TypeFlags.Undefined))
    if (variants.length === 1) return typeSchema(checker, variants[0]!, location, seen)
    return {
      anyOf: variants
        .map(member => typeSchema(checker, member, location, new Set(seen)))
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    }
  }
  if (checker.isTupleType(type)) {
    const arguments_ = checker.getTypeArguments(type as ts.TypeReference)
    return {
      type: 'array',
      prefixItems: arguments_.map(member => typeSchema(checker, member, location, new Set(seen))),
      minItems: arguments_.length,
      maxItems: arguments_.length
    }
  }
  if (checker.isArrayType(type)) {
    const element = checker.getTypeArguments(type as ts.TypeReference)[0]
    if (!element) throw new Error(`Unconstrained array output type: ${checker.typeToString(type, location)}`)
    return { type: 'array', items: typeSchema(checker, element, location, new Set(seen)) }
  }
  if (!(type.flags & ts.TypeFlags.Object) && !(type.flags & ts.TypeFlags.Intersection)) {
    throw new Error(`Unsupported output type: ${checker.typeToString(type, location)}`)
  }

  const typeId = (type as ts.Type & { id?: number }).id
  if (typeId !== undefined) {
    if (seen.has(typeId)) throw new Error(`Recursive output type: ${checker.typeToString(type, location)}`)
    seen.add(typeId)
  }

  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []
  for (const property of checker.getPropertiesOfType(type).sort((left, right) => left.name.localeCompare(right.name))) {
    const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? location
    const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration)
    properties[property.name] = typeSchema(checker, propertyType, declaration, new Set(seen))
    if (!(property.flags & ts.SymbolFlags.Optional) && !(propertyType.flags & ts.TypeFlags.Undefined)) required.push(property.name)
  }

  const stringIndex = checker.getIndexTypeOfType(type, ts.IndexKind.String)
  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required: required.sort() } : {}),
    additionalProperties: stringIndex ? typeSchema(checker, stringIndex, location, new Set(seen)) : false
  }
}

export function assertConstrainedOutputSchema(schema: JsonSchema, path = '$'): void {
  if (schema === true) throw new Error(`Unconstrained output schema at ${path}`)
  if (schema === false) return

  for (const [key, value] of Object.entries(schema)) {
    if (key === 'not') continue
    if (key === 'additionalProperties' && (value === true || (typeof value === 'object' && value !== null && Object.keys(value).length === 0))) {
      throw new Error(`Unconstrained object properties at ${path}`)
    }
    if (typeof value === 'boolean') {
      if (value && (key === 'items' || key === 'additionalProperties')) throw new Error(`Unconstrained ${key} at ${path}`)
      continue
    }
    if (Array.isArray(value)) {
      value.forEach((member, index) => {
        if (typeof member === 'object' && member !== null) assertConstrainedOutputSchema(member as JsonSchema, `${path}.${key}[${index}]`)
      })
      continue
    }
    if (typeof value === 'object' && value !== null) assertConstrainedOutputSchema(value as JsonSchema, `${path}.${key}`)
  }
}

export function generateOutputSchemaSource() {
  const configPath = '.nuxt/tsconfig.server.json'
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.nuxt')
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  const checker = program.getTypeChecker()
  const schemas = new Map<string, JsonSchema>()

  for (const source of program.getSourceFiles()) {
    if (!/server\/api\/.+\.(get|post|put|patch|delete)\.ts$/.test(source.fileName)) continue
    source.forEachChild((node) => {
      if (!ts.isVariableStatement(node)) return
      for (const declaration of node.declarationList.declarations) {
        if (declaration.name.getText() !== 'applicationOperation' || !declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue
        const id = operationId(declaration.initializer)
        const executor = declaration.initializer.arguments[1]
        if (!id || !executor || (!ts.isArrowFunction(executor) && !ts.isFunctionExpression(executor))) continue
        const signature = checker.getSignatureFromDeclaration(executor)
        const output = signature && checker.getAwaitedType(checker.getReturnTypeOfSignature(signature))
        if (!output) throw new Error(`Cannot infer output for ${id}`)
        const schema = typeSchema(checker, output, executor)
        assertConstrainedOutputSchema(schema, id)
        schemas.set(id, schema)
      }
    })
  }

  const entries = [...schemas].sort(([left], [right]) => left.localeCompare(right))
  const expectedCount = mcpEligibilityManifest.filter(entry => entry.disposition === 'include').length
  if (entries.length !== expectedCount) throw new Error(`Expected ${expectedCount} operation outputs, found ${entries.length}`)
  const body = entries.map(([id, schema]) => `  ${JSON.stringify(id)}: () => z.fromJSONSchema(${JSON.stringify(schema)})`).join(',\n')
  return `/* eslint-disable */\n// Generated by tools/mcp/generate-output-schemas.ts. Do not edit by hand.\nimport { z } from 'zod'\n\nexport const structuredOperationOutputSchemaFactories = {\n${body}\n} as const\n\nexport type StructuredOperationId = keyof typeof structuredOperationOutputSchemaFactories\n\nconst structuredOperationOutputSchemaCache = new Map<StructuredOperationId, z.ZodTypeAny>()\n\nexport function getStructuredOperationOutputSchema<TId extends StructuredOperationId>(id: TId) {\n  const cached = structuredOperationOutputSchemaCache.get(id)\n  if (cached) return cached\n\n  const schema = structuredOperationOutputSchemaFactories[id]()\n  structuredOperationOutputSchemaCache.set(id, schema)\n  return schema\n}\n`
}

const outputPath = 'server/application/operations/generated-output-schemas.ts'
if (import.meta.main) {
  const generated = generateOutputSchemaSource()
  if (process.argv.includes('--check')) {
    if (readFileSync(outputPath, 'utf8') !== generated) throw new Error(`${outputPath} is stale; run bun tools/mcp/generate-output-schemas.ts`)
  } else {
    writeFileSync(outputPath, generated)
  }
}
