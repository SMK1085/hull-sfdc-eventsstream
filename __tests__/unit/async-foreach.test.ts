import asyncForEach from "../../src/utils/async-foreach";

describe("asyncForEach", () => {
  let checkSum: number;
  it("should await all promises", async () => {
    const list = [1, 4];
    checkSum = 0;
    await asyncForEach(list, async (num: number) => {
      const fooPromise = (): Promise<unknown> => {
        // eslint-disable-next-line promise/param-names
        return new Promise((resolve) => {
          setTimeout(() => {
            checkSum += num;
            resolve(true);
          }, 1500);
        });
      };
      await fooPromise();
    });

    expect(checkSum).toEqual(5);
  });
});
