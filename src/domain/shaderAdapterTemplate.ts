export const SHADER_ADAPTER_TEMPLATE = {
  version: 1,
  instructions: 'Each rule matches a Unity shader name. Property arrays are checked from left to right.',
  rules: [
    {
      shader: 'YourCompany/CharacterToon',
      baseMap: ['_BaseMap', '_MainTex', '_CharacterTex'],
      baseColor: ['_BaseColor', '_Color', '_TintColor'],
      normalMap: ['_BumpMap', '_NormalMap'],
      emissionMap: ['_EmissionMap', '_GlowTex'],
      emissionColor: ['_EmissionColor', '_GlowColor'],
      alphaCutoff: '_Cutoff',
      surface: 'auto',
      doubleSided: false,
    },
  ],
  aiPrompt: [
    'Analyze the attached Unity .mat YAML and optional Shader file.',
    'Return only valid JSON using this exact schema.',
    'Map the base color texture, tint color, normal map, emission map, alpha cutoff, surface mode and double-sided state.',
    'surface must be auto, opaque, cutout, or transparent.',
    'Do not invent property names that are absent from the material or shader.',
  ].join(' '),
}

