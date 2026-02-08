//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from "assert";
import { toMarkdown } from "../../src/toMarkdown";

// Defines a Mocha test suite to group tests of similar kind together
suite("toMarkdown Tests", () => {
  // Test that pipe characters in table cells are properly escaped
  test("should escape pipe characters in table cell content", () => {
    const html = `
      <table>
        <tr>
          <td>Option A | Option B</td>
        </tr>
      </table>
    `;

    const result = toMarkdown(html, {
      emDelimiter: "*",
    });

    // The pipe character should be escaped as \|
    // Expected: | Option A \| Option B |
    assert.ok(
      result.includes("Option A \\| Option B"),
      `Expected escaped pipe, but got: ${result}`
    );

    // Should not create extra columns (should be a single cell)
    // Count the number of pipes in the row (excluding escaped ones)
    const rowMatch = result.match(/\n\|[^\n]+\|/);
    assert.ok(rowMatch, "Should contain a table row");
    if (rowMatch) {
      const row = rowMatch[0];
      // Count unescaped pipes by replacing escaped pipes temporarily
      const tempRow = row.replace(/\\\|/g, "ESCAPED_PIPE");
      const unescapedPipes = (tempRow.match(/\|/g) || []).length;
      // Should have exactly 2 pipes (start and end of single cell row)
      assert.strictEqual(
        unescapedPipes,
        2,
        `Expected 2 unescaped pipes (start and end), but found ${unescapedPipes} in: ${row}`
      );
    }
  });

  test("should handle multiple pipe characters in table cell", () => {
    const html = `
      <table>
        <tr>
          <td>a |= y | b</td>
        </tr>
      </table>
    `;

    const result = toMarkdown(html, {
      emDelimiter: "*",
    });

    // All pipe characters should be escaped
    assert.ok(
      result.includes("a \\|= y \\| b"),
      `Expected all pipes escaped, but got: ${result}`
    );
  });

  test("should handle table with multiple cells containing pipes", () => {
    const html = `
      <table>
        <tr>
          <td>Option A | Option B</td>
          <td>Value | Test</td>
        </tr>
      </table>
    `;

    const result = toMarkdown(html, {
      emDelimiter: "*",
    });

    // Both cells should have escaped pipes
    assert.ok(
      result.includes("Option A \\| Option B"),
      `First cell should have escaped pipe: ${result}`
    );
    assert.ok(
      result.includes("Value \\| Test"),
      `Second cell should have escaped pipe: ${result}`
    );

    // Should have exactly 3 unescaped pipes per row (start, between cells, end)
    const rowMatch = result.match(/\n\|[^\n]+\|/);
    assert.ok(rowMatch, "Should contain a table row");
    if (rowMatch) {
      const row = rowMatch[0];
      // Count unescaped pipes by replacing escaped pipes temporarily
      const tempRow = row.replace(/\\\|/g, "ESCAPED_PIPE");
      const unescapedPipes = (tempRow.match(/\|/g) || []).length;
      assert.strictEqual(
        unescapedPipes,
        3,
        `Expected 3 unescaped pipes (start, separator, end), but found ${unescapedPipes} in: ${row}`
      );
    }
  });

  test("should not affect tables without pipe characters", () => {
    const html = `
      <table>
        <tr>
          <td>Normal Cell Content</td>
          <td>Another Cell</td>
        </tr>
      </table>
    `;

    const result = toMarkdown(html, {
      emDelimiter: "*",
    });

    // Should still work correctly for normal tables
    assert.ok(
      result.includes("Normal Cell Content"),
      "Should contain normal content"
    );
    assert.ok(result.includes("Another Cell"), "Should contain second cell");
    assert.ok(result.includes("|"), "Should contain table structure");
  });

  test("should handle table headers with pipe characters", () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th>Header A | Header B</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Content</td>
          </tr>
        </tbody>
      </table>
    `;

    const result = toMarkdown(html, {
      emDelimiter: "*",
    });

    // Header cell should have escaped pipe
    assert.ok(
      result.includes("Header A \\| Header B"),
      `Header should have escaped pipe: ${result}`
    );
  });
});
