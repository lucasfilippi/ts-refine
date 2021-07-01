import test from 'ava';
import TypedFastBitSet from 'typedfastbitset';

import { deserializeBitSet, serializeBitSet } from './bitsetserializer';

test('bitsetserializer', (t) => {
  const input = [];
  for (let i = 0; i < 1000; i++) {
    input.push(Math.floor(Math.random() * 10000));
  }

  const bs = new TypedFastBitSet(input);

  const serialized = serializeBitSet(bs);
  t.log(serialized);

  const deserialized = deserializeBitSet(serialized);

  //assert no change between original and deserialized bitset
  t.deepEqual(bs.change_size(deserialized), 0);
  t.deepEqual(deserialized.array(), bs.array());
});
