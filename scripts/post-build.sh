#!/bin/sh
mv ./dist/soonaverse ./dist/localized
cp -r ./dist/localized/en/* ./dist/
mv ./dist/localized/pt_BR ./dist/localized/pt_BR
mv ./dist/localized/pt_PT ./dist/localized/pt_PT
mv ./dist/localized/zh_CN ./dist/localized/zh_CN
mv ./dist/localized/zh_TW ./dist/localized/zh_TW