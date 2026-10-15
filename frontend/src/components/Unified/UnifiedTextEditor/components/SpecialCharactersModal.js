import React, { useState, useMemo } from 'react';
import { Modal, Tabs, Input, Button, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const SYMBOL_CATEGORIES = {
  "Arrows": [
    { char: "←", name: "left arrow" },
    { char: "↑", name: "up arrow" },
    { char: "→", name: "right arrow" },
    { char: "↓", name: "down arrow" },
    { char: "↔", name: "left right arrow" },
    { char: "↕", name: "up down arrow" },
    { char: "↖", name: "north west arrow" },
    { char: "↗", name: "north east arrow" },
    { char: "↘", name: "south east arrow" },
    { char: "↙", name: "south west arrow" },
    { char: "⇐", name: "left double arrow" },
    { char: "⇒", name: "right double arrow" },
    { char: "⇔", name: "left right double arrow" },
    { char: "⇕", name: "up down double arrow" },
    { char: "➔", name: "heavy wide-headed right arrow" },
    { char: "⇄", name: "rightwards arrow over leftwards arrow" },
    { char: "⇅", name: "upwards arrow leftwards of downwards arrow" }
  ],
  "Math": [
    { char: "±", name: "plus-minus" },
    { char: "×", name: "multiplication times" },
    { char: "÷", name: "division" },
    { char: "≠", name: "not equal" },
    { char: "≈", name: "almost equal approximation" },
    { char: "≤", name: "less-than or equal to" },
    { char: "≥", name: "greater-than or equal to" },
    { char: "√", name: "square root radical" },
    { char: "∞", name: "infinity" },
    { char: "∑", name: "n-ary summation sum" },
    { char: "∏", name: "n-ary product prod" },
    { char: "∂", name: "partial differential" },
    { char: "∫", name: "integral" },
    { char: "∆", name: "increment delta" },
    { char: "∇", name: "nabla gradient" },
    { char: "∝", name: "proportional to" },
    { char: "∠", name: "angle" },
    { char: "⊥", name: "perpendicular" },
    { char: "≡", name: "identical to" },
    { char: "≅", name: "approximately equal to" },
    { char: "⊂", name: "subset of" },
    { char: "⊃", name: "superset of" },
    { char: "⊆", name: "subset of or equal to" },
    { char: "⊇", name: "superset of or equal to" },
    { char: "∈", name: "element of" },
    { char: "∉", name: "not an element of" },
    { char: "∩", name: "intersection" },
    { char: "∪", name: "union" }
  ],
  "Greek": [
    { char: "α", name: "alpha" }, { char: "β", name: "beta" },
    { char: "γ", name: "gamma" }, { char: "δ", name: "delta" },
    { char: "ε", name: "epsilon" }, { char: "ζ", name: "zeta" },
    { char: "η", name: "eta" }, { char: "θ", name: "theta" },
    { char: "ι", name: "iota" }, { char: "κ", name: "kappa" },
    { char: "λ", name: "lambda" }, { char: "μ", name: "mu micro" },
    { char: "ν", name: "nu" }, { char: "ξ", name: "xi" },
    { char: "ο", name: "omicron" }, { char: "π", name: "pi" },
    { char: "ρ", name: "rho" }, { char: "σ", name: "sigma" },
    { char: "τ", name: "tau" }, { char: "υ", name: "upsilon" },
    { char: "φ", name: "phi" }, { char: "χ", name: "chi" },
    { char: "ψ", name: "psi" }, { char: "ω", name: "omega" },
    { char: "Α", name: "Alpha uppercase" }, { char: "Β", name: "Beta uppercase" },
    { char: "Γ", name: "Gamma uppercase" }, { char: "Δ", name: "Delta uppercase" },
    { char: "Ε", name: "Epsilon uppercase" }, { char: "Ζ", name: "Zeta uppercase" },
    { char: "Η", name: "Eta uppercase" }, { char: "Θ", name: "Theta uppercase" },
    { char: "Ι", name: "Iota uppercase" }, { char: "Κ", name: "Kappa uppercase" },
    { char: "Λ", name: "Lambda uppercase" }, { char: "Μ", name: "Mu uppercase" },
    { char: "Ν", name: "Nu uppercase" }, { char: "Ξ", name: "Xi uppercase" },
    { char: "Ο", name: "Omicron uppercase" }, { char: "Π", name: "Pi uppercase" },
    { char: "Ρ", name: "Rho uppercase" }, { char: "Σ", name: "Sigma uppercase" },
    { char: "Τ", name: "Tau uppercase" }, { char: "Υ", name: "Upsilon uppercase" },
    { char: "Φ", name: "Phi uppercase" }, { char: "Χ", name: "Chi uppercase" },
    { char: "Ψ", name: "Psi uppercase" }, { char: "Ω", name: "Omega uppercase" }
  ],
  "Currency": [
    { char: "$", name: "dollar sign usd" },
    { char: "€", name: "euro eur" },
    { char: "£", name: "pound sign gbp sterling" },
    { char: "¥", name: "yen yuan cny jpy" },
    { char: "₹", name: "indian rupee inr" },
    { char: "₽", name: "russian ruble rub" },
    { char: "₩", name: "korean won krw" },
    { char: "₪", name: "shekel ils" },
    { char: "¢", name: "cent sign" },
    { char: "¤", name: "currency sign" },
    { char: "₫", name: "dong vnd" },
    { char: "₭", name: "kip lak" },
    { char: "₮", name: "tugrik mnt" }
  ],
  "Superscripts and Subscripts": [
    { char: "®", name: "registered trademark symbol superscript" },
    { char: "™", name: "trademark symbol superscript" },
    { char: "©", name: "copyright symbol" },
    { char: "⁰", name: "superscript zero" }, { char: "¹", name: "superscript one" },
    { char: "²", name: "superscript two" }, { char: "³", name: "superscript three" },
    { char: "⁴", name: "superscript four" }, { char: "⁵", name: "superscript five" },
    { char: "⁶", name: "superscript six" }, { char: "⁷", name: "superscript seven" },
    { char: "⁸", name: "superscript eight" }, { char: "⁹", name: "superscript nine" },
    { char: "⁺", name: "superscript plus" }, { char: "⁻", name: "superscript minus" },
    { char: "⁼", name: "superscript equals" }, { char: "⁽", name: "superscript left parenthesis" },
    { char: "⁾", name: "superscript right parenthesis" }, { char: "ⁿ", name: "superscript n" },
    { char: "ⁱ", name: "superscript i" },
    { char: "₀", name: "subscript zero" }, { char: "₁", name: "subscript one" },
    { char: "₂", name: "subscript two" }, { char: "₃", name: "subscript three" },
    { char: "₄", name: "subscript four" }, { char: "₅", name: "subscript five" },
    { char: "₆", name: "subscript six" }, { char: "₇", name: "subscript seven" },
    { char: "₈", name: "subscript eight" }, { char: "₉", name: "subscript nine" },
    { char: "₊", name: "subscript plus" }, { char: "₋", name: "subscript minus" },
    { char: "₌", name: "subscript equals" }, { char: "₍", name: "subscript left parenthesis" },
    { char: "₎", name: "subscript right parenthesis" },
    { char: "ₐ", name: "subscript a" }, { char: "ₑ", name: "subscript e" },
    { char: "ₒ", name: "subscript o" }, { char: "ₓ", name: "subscript x" },
    { char: "ₕ", name: "subscript h" }, { char: "ₖ", name: "subscript k" },
    { char: "ₗ", name: "subscript l" }, { char: "ₘ", name: "subscript m" },
    { char: "ₙ", name: "subscript n" }, { char: "ₚ", name: "subscript p" },
    { char: "ₛ", name: "subscript s" }, { char: "ₜ", name: "subscript t" }
  ],
  "Accents": [
    { char: "À", name: "latin capital letter a with grave" },
    { char: "Á", name: "latin capital letter a with acute" },
    { char: "Â", name: "latin capital letter a with circumflex" },
    { char: "Ã", name: "latin capital letter a with tilde" },
    { char: "Ä", name: "latin capital letter a with diaeresis" },
    { char: "Å", name: "latin capital letter a with ring above" },
    { char: "Æ", name: "latin capital letter ae" },
    { char: "Ç", name: "latin capital letter c with cedilla" },
    { char: "È", name: "latin capital letter e with grave" },
    { char: "É", name: "latin capital letter e with acute" },
    { char: "Ê", name: "latin capital letter e with circumflex" },
    { char: "Ë", name: "latin capital letter e with diaeresis" },
    { char: "Ì", name: "latin capital letter i with grave" },
    { char: "Í", name: "latin capital letter i with acute" },
    { char: "Î", name: "latin capital letter i with circumflex" },
    { char: "Ï", name: "latin capital letter i with diaeresis" },
    { char: "Ñ", name: "latin capital letter n with tilde" },
    { char: "Ò", name: "latin capital letter o with grave" },
    { char: "Ó", name: "latin capital letter o with acute" },
    { char: "Ô", name: "latin capital letter o with circumflex" },
    { char: "Õ", name: "latin capital letter o with tilde" },
    { char: "Ö", name: "latin capital letter o with diaeresis" },
    { char: "Ø", name: "latin capital letter o with stroke" },
    { char: "Œ", name: "latin capital ligature oe" },
    { char: "Ù", name: "latin capital letter u with grave" },
    { char: "Ú", name: "latin capital letter u with acute" },
    { char: "Û", name: "latin capital letter u with circumflex" },
    { char: "Ü", name: "latin capital letter u with diaeresis" },
    { char: "Ý", name: "latin capital letter y with acute" },
    { char: "ß", name: "latin small letter sharp s" }
  ],
  "Symbols": [
    { char: "©", name: "copyright symbol" },
    { char: "®", name: "registered trademark symbol" },
    { char: "™", name: "trademark symbol" },
    { char: "§", name: "section sign" },
    { char: "¶", name: "pilcrow paragraph sign" },
    { char: "•", name: "bullet point" },
    { char: "°", name: "degree sign" },
    { char: "†", name: "dagger" },
    { char: "‡", name: "double dagger" },
    { char: "¿", name: "inverted question mark" },
    { char: "¡", name: "inverted exclamation mark" },
    { char: "«", name: "left angle quotation mark" },
    { char: "»", name: "right angle quotation mark" },
    { char: "…", name: "horizontal ellipsis" },
    { char: "–", name: "en dash" },
    { char: "—", name: "em dash" },
    { char: "‰", name: "per mille sign" }
  ]
};

const SpecialCharactersModal = ({ visible, onCancel, onInsert }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Arrows');

  const filteredSymbols = useMemo(() => {
    if (!searchTerm.trim()) return null;
    const results = [];
    const query = searchTerm.toLowerCase();

    Object.values(SYMBOL_CATEGORIES).flat().forEach((symbol) => {
      if (symbol.name.toLowerCase().includes(query) || symbol.char.includes(query)) {
        if (!results.some(r => r.char === symbol.char)) {
          results.push(symbol);
        }
      }
    });
    return results;
  }, [searchTerm]);

  const handleSelectSymbol = (symbol) => {
    onInsert(symbol.char);
  };

  const renderGrid = (symbolsList) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))',
      gap: '8px',
      maxHeight: '320px',
      overflowY: 'auto',
      padding: '8px 4px'
    }}>
      {symbolsList.map((symbol) => (
        <Tooltip key={symbol.char} title={symbol.name} mouseEnterDelay={0.4}>
          <Button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelectSymbol(symbol)}
            style={{
              height: '42px',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
          >
            {symbol.char}
          </Button>
        </Tooltip>
      ))}
    </div>
  );

  return (
    <Modal
      title="Insert Special Character"
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Input
        prefix={<SearchOutlined />}
        placeholder="Search by keyword (e.g. arrow, pi, alpha, copyright)"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />

      {filteredSymbols ? (
        <div>
          <div style={{ marginBottom: 8, fontWeight: 'bold' }}>Search Results:</div>
          {filteredSymbols.length > 0 ? (
            renderGrid(filteredSymbols)
          ) : (
            <div style={{ textAlign: 'center', color: '#999', margin: '24px 0' }}>
              No matching special characters found
            </div>
          )}
        </div>
      ) : (
        <div onMouseDown={(e) => e.preventDefault()}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            items={Object.keys(SYMBOL_CATEGORIES).map(categoryName => ({
              key: categoryName,
              label: categoryName,
              children: renderGrid(SYMBOL_CATEGORIES[categoryName])
            }))}
          />
        </div>
      )}
    </Modal>
  );
};

export default SpecialCharactersModal;
