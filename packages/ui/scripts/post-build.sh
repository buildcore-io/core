#!/bin/sh
mv ./dist/soonaverse ./dist/localized
cp -r ./dist/localized/en/* ./dist/
# mv ./dist/localized/pt-BR ./dist/localized/pt_BR
# mv ./dist/localized/pt-PT ./dist/localized/pt_PT
mv ./dist/localized/zh-CN ./dist/localized/zh_CN
# mv ./dist/localized/zh-TW ./dist/localized/zh_TW
