import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  rules: {
    // #31 的 main.ts 把 let/function 插在了 import 中间
    'no-restricted-syntax': ['error', {
      selector: 'Program > :not(ImportDeclaration) ~ ImportDeclaration',
      message: 'import 必须全部写在文件顶部：把这条 import 挪到其它语句之前，再把代码放到最后一条 import 之后。',
    }],
  },
});
