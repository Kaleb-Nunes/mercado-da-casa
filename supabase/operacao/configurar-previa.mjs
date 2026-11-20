// Executar na raiz do checkout. Inspecionar o diff antes de publicar.
import {readFileSync,writeFileSync} from 'node:fs';
const [origem,url,chavePublicavel]=process.argv.slice(2);
if(!/^https:\/\/[a-z0-9-]+\.elida-homologacao\.pages\.dev$/.test(origem) ||
   !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) ||
   !/^sb_publishable_[A-Za-z0-9_-]+$/.test(chavePublicavel)){
  throw Error('Informe a origem exata da prévia, a URL do projeto e a chave pública sb_publishable_.');
}
const headers=readFileSync('_headers','utf8');
const directive="connect-src 'self'";
if(!headers.includes(directive))throw Error('Diretiva connect-src ausente.');
const updated=headers.replace(/(connect-src 'self')(?: https:\/\/[a-z0-9]+\.supabase\.co)?/,directive+' '+url);
writeFileSync('_headers',updated);
writeFileSync('elida-supabase-config.js','window.ELIDA_SUPABASE=Object.freeze('+JSON.stringify({origem,url,chavePublicavel})+');\n');
