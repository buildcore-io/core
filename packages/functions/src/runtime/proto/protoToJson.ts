/* eslint-disable @typescript-eslint/no-explicit-any */
import { set } from 'lodash';
import { Message } from 'protobufjs';

export const protoToJson = (proto: Message<any>) => {
  const json = proto.toJSON();

  const current = json.value?.fields;
  if (current) {
    set(json, 'value.fields', protoJsonToJson(current));
  }
  const prev = json.oldValue?.fields;
  if (prev !== undefined) {
    set(json, 'oldValue.fields', protoJsonToJson(prev));
  }
  return json;
};

const protoJsonToJson = (protoJson: { [key: string]: any }) =>
  Object.entries(protoJson).reduce(
    (acc, [key, value]) => ({ ...acc, [key]: valueToJson(value) }),
    {} as { [key: string]: any },
  );

const valueToJson = (data: { [key: string]: any }): any => {
  const [type, value] = Object.entries(data)[0];
  switch (type) {
    case 'booleanValue':
    case 'integerValue':
    case 'doubleValue':
    case 'timestampValue':
    case 'stringValue':
    case 'bytes':
    case 'referenceValue':
      return value;
    case 'arrayValue':
      return (value.values as any[]).map(valueToJson);
    case 'mapValue':
      return protoJsonToJson(value.fields);
  }
};
