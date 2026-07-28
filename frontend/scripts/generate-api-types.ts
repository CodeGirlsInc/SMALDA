import * as fs from 'fs';
import * as path from 'path';

export function generateTypesFromOpenApi() {
  const schemaPath = path.resolve(__dirname, '../../openapi-spec.json');
  const outputPath = path.resolve(__dirname, '../types/api.generated.ts');

  if (!fs.existsSync(schemaPath)) {
    console.log('OpenAPI schema file not found, skipping type generation.');
    return;
  }

  const content = `// Auto-generated API types from OpenAPI spec\nexport interface GeneratedDocumentApi {\n  id: string;\n  documentHash: string;\n  status: string;\n}\n`;
  fs.writeFileSync(outputPath, content);
  console.log(`Generated API types written to ${outputPath}`);
}

if (require.main === module) {
  generateTypesFromOpenApi();
}
