import {
  ALIAS_ADDRESS_TYPE,
  IIssuerFeature,
  IMetadataFeature,
  INftOutput,
  ISSUER_FEATURE_TYPE,
  METADATA_FEATURE_TYPE,
  NFT_ADDRESS_TYPE,
} from '@iota/iota.js-next';
import { Converter } from '@iota/util.js-next';
import Joi from 'joi';

export const getNftOutputMetadata = (output: INftOutput | undefined) => {
  try {
    const metadataFeature = <IMetadataFeature | undefined>(
      output?.immutableFeatures?.find((f) => f.type === METADATA_FEATURE_TYPE)
    );
    const decoded = Converter.hexToUtf8(metadataFeature?.data || '{}');
    const metadata = JSON.parse(decoded);
    return metadata || {};
  } catch (e) {
    return {};
  }
};

export const nftIrc27Schema = Joi.object({
  collectionId: Joi.string().required(),
  collectionName: Joi.string().required(),
  uri: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().required(),
});

export const collectionIrc27Scheam = Joi.object({
  uri: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().required(),
  attributes: Joi.array()
    .items(
      Joi.object({
        trait_type: Joi.string().required(),
        value: Joi.any().required(),
      }),
    )
    .optional(),
  royalties: Joi.object().pattern(Joi.string(), Joi.number()).optional(),
});

export const isMetadataIrc27 = (metadata: Record<string, unknown>, schema: Joi.ObjectSchema) => {
  const result = schema.validate(metadata, { allowUnknown: true });
  return result.error === undefined;
};

export const getAliasId = (output: INftOutput) => {
  const issuer = <IIssuerFeature | undefined>(
    output.immutableFeatures?.find((f) => f.type === ISSUER_FEATURE_TYPE)
  );
  if (!issuer || issuer.address.type !== ALIAS_ADDRESS_TYPE) {
    return '';
  }
  return issuer.address.aliasId;
};

export const getIssuerNftId = (output: INftOutput) => {
  const issuer = <IIssuerFeature | undefined>(
    output.immutableFeatures?.find((f) => f.type === ISSUER_FEATURE_TYPE)
  );
  if (!issuer || issuer.address.type !== NFT_ADDRESS_TYPE) {
    return '';
  }
  return issuer.address.nftId;
};
