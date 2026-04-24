flag = 'MKK{PlaY_FaIr_wE_aRE_aLways_watchiNG}'
html = []
for c in flag:
    if c.isupper():
        html.append(f'        <img src=\"/assets/hieroglyphics/Alternian%20Alphabet/upper%20case/{c}.png\" alt=\"{c}\">')
    elif c.islower():
        html.append(f'        <img src=\"/assets/hieroglyphics/Alternian%20Alphabet/lower%20case/{c}.png\" alt=\"{c}\">')
    else:
        html.append(f'        <span style=\"color: var(--cyan); font-family: ''JetBrains Mono'', monospace; font-size: 1.5rem; font-weight: bold; margin: 0 4px;\">{c}</span>')

print('\n'.join(html))
