
export const expectThrow = <C, E>(call: C, error: E) => {
  (<any>expect(call)).rejects.toThrowError(error)
}
