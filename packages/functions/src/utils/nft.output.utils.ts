import {
  AddressType,
  AliasAddress,
  FeatureType,
  IssuerFeature,
  MetadataFeature,
  NftAddress,
  NftOutput,
  hexToUtf8,
} from '@iota/sdk';
import Joi from 'joi';

export const getNftOutputMetadata = (output: NftOutput | undefined) => {
  try {
    const metadataFeature = <MetadataFeature | undefined>(
      output?.immutableFeatures?.find((f) => f.type === FeatureType.Metadata)
    );
    const decoded = hexToUtf8(metadataFeature?.data || '{}');
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
  description: Joi.string().optional().default(''),
});

export const collectionIrc27Scheam = Joi.object({
  uri: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().optional().default(''),
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
  return result.error === undefined ? result.value : undefined;
};

export const getAliasId = (output: NftOutput) => {
  const issuer = <IssuerFeature | undefined>(
    output.immutableFeatures?.find((f) => f.type === FeatureType.Issuer)
  );
  if (!issuer || issuer.address.type !== AddressType.Alias) {
    return '';
  }
  return (issuer.address as AliasAddress).aliasId;
};

export const getIssuerNftId = (output: NftOutput) => {
  const issuer = <IssuerFeature | undefined>(
    output.immutableFeatures?.find((f) => f.type === FeatureType.Issuer)
  );
  if (!issuer || issuer.address.type !== AddressType.Nft) {
    return '';
  }
  return (issuer.address as NftAddress).nftId;
};
