import TypedFastBitSet from 'typedfastbitset';

//see here : https://gist.github.com/skratchdot/e095036fad80597f1c1a

export function deserializeBitSet(data: string): TypedFastBitSet {
  const buf = new ArrayBuffer(data.length * 2); // 2 bytes for each char
  const bufView = new Uint16Array(buf);
  for (let i = 0, strLen = data.length; i < strLen; i++) {
    bufView[i] = data.charCodeAt(i);
  }
  return TypedFastBitSet.fromWords(new Uint32Array(buf));
}

export function serializeBitSet(bitset: TypedFastBitSet): string {
  return String.fromCharCode.apply(
    null,
    new Uint16Array(bitset.words.buffer) as unknown as number[]
  );
}
