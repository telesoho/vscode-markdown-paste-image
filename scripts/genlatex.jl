include("/usr/share/julia/base/latex_symbols.jl")

# find(latex_symbols, "⟺")  # returns  "\\Longleftrightarrow"
open(joinpath(dirname(@__FILE__), "..", "latex.ts"), "w") do f
  println(f, "export const latexSymbols = {")
  # sort by name length and name content
  symbols = sort(collect(latex_symbols))
  symbols = sort(symbols, by=x->length(x[1]))
  for (name, sym) in symbols
    println(f, "    '" * name[2:length(name)] * "': '$sym',")
    # println(f, "    '\\$name': '$sym',")
  end
  println(f, "};")
end