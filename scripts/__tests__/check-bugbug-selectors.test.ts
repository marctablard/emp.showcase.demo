const { findMissingTestIds, isProductComponent } = require('../check-bugbug-selectors.cjs') as {
  findMissingTestIds: (source: string) => { tag: string; line: number }[];
  isProductComponent: (relPath: string) => boolean;
};

describe('check-bugbug-selectors', () => {
  it('flags actionable JSX without data-testid', () => {
    const source = `
      export function QuoteActions() {
        return (
          <div>
            <Button onClick={onReject}>Reject</Button>
            <Input value={comment} onChange={onChange} />
          </div>
        );
      }
    `;
    expect(findMissingTestIds(source).map((item) => item.tag)).toEqual(['Button', 'Input']);
  });

  it('accepts data-testid on the opening tag, including multiline props', () => {
    const source = `
      <Button
        variant="secondary"
        onClick={onCancel}
        data-testid="quote-cancelButton"
      >
        Cancel
      </Button>
    `;
    expect(findMissingTestIds(source)).toEqual([]);
  });

  it('skips asChild wrappers and commented-out JSX', () => {
    const source = `
      <DialogTrigger asChild>
        <Button data-testid="addressSelector-trigger">Open</Button>
      </DialogTrigger>
      <DialogClose asChild>
        <Button data-testid="return-cancelButton">Cancel</Button>
      </DialogClose>
      {/* <Button onClick={legacy}>old</Button> */}
    `;
    expect(findMissingTestIds(source)).toEqual([]);
  });

  it('only flags TableRow when it is clickable', () => {
    const source = `
      <TableRow className="header"><TableHead>Id</TableHead></TableRow>
      <TableRow onClick={openQuote}><TableCell>Q1</TableCell></TableRow>
    `;
    expect(findMissingTestIds(source).map((item) => item.tag)).toEqual(['TableRow']);
  });

  it('scopes the check to product TSX, not ui primitives or tests', () => {
    expect(isProductComponent('src/components/cart/quote-request-dialog.tsx')).toBe(true);
    expect(isProductComponent('src/components/ui/button.tsx')).toBe(false);
    expect(isProductComponent('src/components/cart/quote-request-dialog.test.tsx')).toBe(false);
    expect(isProductComponent('scripts/check-bugbug-selectors.cjs')).toBe(false);
  });
});
