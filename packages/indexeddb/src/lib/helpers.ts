import type { Payload } from '@joshdb/provider';

const handleSubCallFail = (res: Payload, payload: Payload) => {
  if (res.errors.length) {
    res.errors.forEach((err) => {
      payload.errors.push(err);
    });

    return true;
  }

  return false;
};

export { handleSubCallFail };
