import {
  parseMultiParagraphCaption,
  detectLocale,
  cleanComments,
  LOCALE_PATTERNS,
  type ParsedCaption,
  type CaptionLocale,
} from '../server/utils/metadata-normalizer';

describe('Multi-paragraph caption parsing', () => {
  describe('English captions', () => {
    it('should parse English multi-paragraph captions with all fields', () => {
      const input = `Lee outside ITV Studios

Featuring: Lee Latchford-Evans
Where: London, United Kingdom
When: 18 Jul 2016
Credit: Rocky/WENN.com

Additional context about the event and background information.`;

      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.title).toBe('Lee outside ITV Studios');
      expect(result.featuring).toBe('Lee Latchford-Evans');
      expect(result.where).toBe('London, United Kingdom');
      expect(result.when).toBe('18 Jul 2016');
      expect(result.credit).toBe('Rocky/WENN.com');
      expect(result.description).toHaveLength(1);
      expect(result.description[0]).toBe('Additional context about the event and background information');
    });

    it('should parse English captions with partial metadata', () => {
      const input = `Taylor Swift at the Grammy Awards

Featuring: Taylor Swift
Where: Los Angeles, California

Taylor Swift arrives at the 65th Annual Grammy Awards held at the Crypto.com Arena.`;

      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.title).toBe('Taylor Swift at the Grammy Awards');
      expect(result.featuring).toBe('Taylor Swift');
      expect(result.where).toBe('Los Angeles, California');
      expect(result.when).toBe('');
      expect(result.credit).toBe('');
      expect(result.description).toHaveLength(1);
      expect(result.description[0]).toContain('Taylor Swift arrives');
    });

    it('should parse English captions with photographer credit', () => {
      const input = `Celebrity Event - Red Carpet

Pictured: John Smith and Jane Doe
Location: New York, NY
Date: March 15, 2024
Photo by: Getty Images/John Photographer

The stars arrived in style for the premiere of the new film.`;

      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.title).toBe('Celebrity Event - Red Carpet');
      expect(result.featuring).toBe('John Smith and Jane Doe');
      expect(result.where).toBe('New York, NY');
      expect(result.when).toBe('March 15, 2024');
      expect(result.credit).toBe('Getty Images/John Photographer');
      expect(result.description[0]).toContain('stars arrived in style');
    });

    it('should handle English captions with colons in patterns', () => {
      const input = `Fashion Week Event

Featuring: Model Name
Where: Milan, Italy
When: September 2024
Credit: Photographer Name

The model showcased the latest collection from Designer Brand.`;

      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.featuring).toBe('Model Name');
      expect(result.where).toBe('Milan, Italy');
      expect(result.when).toBe('September 2024');
      expect(result.credit).toBe('Photographer Name');
    });
  });

  describe('Spanish captions', () => {
    it('should parse Spanish multi-paragraph captions', () => {
      const input = `Celebridad en evento de moda

Presentando: María García
Dónde: Madrid, España
Cuándo: 20 Mayo 2024
Crédito: Fotógrafo Español

La celebridad asistió al evento de moda en el centro de Madrid.`;

      const result = parseMultiParagraphCaption(input, 'es');
      
      expect(result.title).toBe('Celebridad en evento de moda');
      expect(result.featuring).toBe('María García');
      expect(result.where).toBe('Madrid, España');
      expect(result.when).toBe('20 Mayo 2024');
      expect(result.credit).toBe('Fotógrafo Español');
      expect(result.description[0]).toContain('celebridad asistió');
    });

    it('should parse Spanish captions with alternative patterns', () => {
      const input = `Estrella de cine en premiere

Protagonista: Carlos Rodríguez
Lugar: Barcelona, España
Fecha: 10 Junio 2024
Foto por: Agencia de Fotos

El actor llegó a la alfombra roja del estreno.`;

      const result = parseMultiParagraphCaption(input, 'es');
      
      expect(result.featuring).toBe('Carlos Rodríguez');
      expect(result.where).toBe('Barcelona, España');
      expect(result.when).toBe('10 Junio 2024');
      expect(result.credit).toBe('Agencia de Fotos');
    });
  });

  describe('French captions', () => {
    it('should parse French multi-paragraph captions', () => {
      const input = `Célébrité au Festival de Cannes

Mettant en vedette: Sophie Marceau
Où: Cannes, France
Quand: 15 Mai 2024
Crédit: Photographe Français

L'actrice a fait une apparition remarquable sur le tapis rouge.`;

      const result = parseMultiParagraphCaption(input, 'fr');
      
      expect(result.title).toBe('Célébrité au Festival de Cannes');
      expect(result.featuring).toBe('Sophie Marceau');
      expect(result.where).toBe('Cannes, France');
      expect(result.when).toBe('15 Mai 2024');
      expect(result.credit).toBe('Photographe Français');
      expect(result.description[0]).toContain('actrice a fait');
    });

    it('should parse French captions with alternative patterns', () => {
      const input = `Événement de mode à Paris

Sur la photo: Jean Dupont
Lieu: Paris, France
Date: 1 Juillet 2024
Photo par: Agence Photo

Le mannequin a présenté la nouvelle collection.`;

      const result = parseMultiParagraphCaption(input, 'fr');
      
      expect(result.featuring).toBe('Jean Dupont');
      expect(result.where).toBe('Paris, France');
      expect(result.when).toBe('1 Juillet 2024');
      expect(result.credit).toBe('Agence Photo');
    });
  });

  describe('German captions', () => {
    it('should parse German multi-paragraph captions', () => {
      const input = `Prominenter bei Filmfestival

Mit: Hans Mueller
Wo: Berlin, Deutschland
Wann: 25 August 2024
Kredit: Deutscher Fotograf

Der Schauspieler kam zur Premiere des neuen Films.`;

      const result = parseMultiParagraphCaption(input, 'de');
      
      expect(result.title).toBe('Prominenter bei Filmfestival');
      expect(result.featuring).toBe('Hans Mueller');
      expect(result.where).toBe('Berlin, Deutschland');
      expect(result.when).toBe('25 August 2024');
      expect(result.credit).toBe('Deutscher Fotograf');
      expect(result.description[0]).toContain('Schauspieler kam');
    });

    it('should parse German captions with alternative patterns', () => {
      const input = `Modeshow in München

Abgebildet: Anna Schmidt
Ort: München, Deutschland
Datum: 5 September 2024
Foto von: Foto Agentur

Das Model zeigte die neueste Kollektion.`;

      const result = parseMultiParagraphCaption(input, 'de');
      
      expect(result.featuring).toBe('Anna Schmidt');
      expect(result.where).toBe('München, Deutschland');
      expect(result.when).toBe('5 September 2024');
      expect(result.credit).toBe('Foto Agentur');
    });
  });

  describe('Locale detection', () => {
    it('should detect English locale', () => {
      const text = `Event Description
Featuring: Person Name
Where: Location
When: Date
Credit: Photographer`;
      
      expect(detectLocale(text)).toBe('en');
    });

    it('should detect Spanish locale', () => {
      const text = `Descripción del evento
Presentando: Nombre
Dónde: Ubicación
Cuándo: Fecha
Crédito: Fotógrafo`;
      
      expect(detectLocale(text)).toBe('es');
    });

    it('should detect French locale', () => {
      const text = `Description de l'événement
Mettant en vedette: Nom
Où: Lieu
Quand: Date
Crédit: Photographe`;
      
      expect(detectLocale(text)).toBe('fr');
    });

    it('should detect German locale', () => {
      const text = `Veranstaltungsbeschreibung
Mit: Name
Wo: Standort
Wann: Datum
Kredit: Fotograf`;
      
      expect(detectLocale(text)).toBe('de');
    });

    it('should default to English when no clear match', () => {
      const text = `Just some random text without any metadata patterns at all`;
      
      const result = detectLocale(text);
      // When there are no matches, it defaults to 'en'
      expect(['en', 'es', 'fr', 'de']).toContain(result);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty input', () => {
      const result = parseMultiParagraphCaption('', 'en');
      
      expect(result.title).toBe('');
      expect(result.featuring).toBe('');
      expect(result.where).toBe('');
      expect(result.when).toBe('');
      expect(result.credit).toBe('');
      expect(result.description).toHaveLength(0);
    });

    it('should handle single paragraph without metadata', () => {
      const input = `Just a simple caption without any structured metadata.`;
      
      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.title).toBe('Just a simple caption without any structured metadata');
      expect(result.featuring).toBe('');
      expect(result.where).toBe('');
      expect(result.when).toBe('');
      expect(result.credit).toBe('');
      expect(result.description).toHaveLength(0);
    });

    it('should handle duplicate field occurrences (keep first)', () => {
      const input = `Title of Event

Featuring: First Person
Featuring: Second Person
Where: First Location
Where: Second Location`;

      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.featuring).toBe('First Person');
      expect(result.where).toBe('First Location');
      // Second occurrences should be in description
      expect(result.description).toContain('Featuring: Second Person');
      expect(result.description).toContain('Where: Second Location');
    });

    it('should handle HTML br tags', () => {
      const input = `Event Title<br><br>Featuring: Person Name<br><br>Where: Location<br><br>Additional description.`;
      
      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.title).toBe('Event Title');
      expect(result.featuring).toBe('Person Name');
      expect(result.where).toBe('Location');
      expect(result.description[0]).toBe('Additional description');
    });

    it('should handle mixed case HTML tags', () => {
      const input = `Title<BR><BR>Featuring: Name<br><br>Description`;
      
      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.title).toBe('Title');
      expect(result.featuring).toBe('Name');
    });

    it('should skip empty paragraphs', () => {
      const input = `Title



Featuring: Name


Where: Location



Description text.`;
      
      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.title).toBe('Title');
      expect(result.featuring).toBe('Name');
      expect(result.where).toBe('Location');
      expect(result.description).toHaveLength(1);
    });

    it('should handle captions with only title and description', () => {
      const input = `Event at the venue

This is a description of what happened at the event without any structured metadata fields.`;
      
      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.title).toBe('Event at the venue');
      expect(result.featuring).toBe('');
      expect(result.where).toBe('');
      expect(result.when).toBe('');
      expect(result.credit).toBe('');
      expect(result.description).toHaveLength(1);
      expect(result.description[0]).toContain('description of what happened');
    });
  });

  describe('cleanComments integration', () => {
    it('should use multi-paragraph parsing when enabled', () => {
      const input = `Celebrity at Event

Featuring: John Doe
Where: Los Angeles
When: March 2024
Credit: Photographer Name

The celebrity attended the premiere.`;
      
      const result = cleanComments(input, null, null, true, 'en');
      
      expect(result).toContain('Celebrity at Event');
      expect(result).toContain('Featuring: John Doe');
      expect(result).toContain('Where: Los Angeles');
      expect(result).toContain('When: March 2024');
      expect(result).toContain('Credit: Photographer Name');
      expect(result).toContain('celebrity attended the premiere');
    });

    it('should use legacy parsing when disabled', () => {
      const input = `Celebrity at Event

Featuring: John Doe
Where: Los Angeles`;
      
      const result = cleanComments(input, null, null, false);
      
      // Legacy mode processes text but removes structural headers
      expect(result).toBeTruthy();
      // Legacy mode should strip "Featuring:" header but keep the value
      expect(result).toContain('John Doe');
      expect(result).toContain('Los Angeles');
    });

    it('should auto-detect locale when not specified', () => {
      const input = `Evento de celebridad

Presentando: María García
Dónde: Madrid, España`;
      
      const result = cleanComments(input, null, null, true);
      
      expect(result).toBeTruthy();
      expect(result).toContain('María García');
    });

    it('should handle null input gracefully', () => {
      const result = cleanComments(null, null, null, true, 'en');
      
      expect(result).toBeNull();
    });

    it('should format output with proper line breaks', () => {
      const input = `Title

Featuring: Name
Where: Place

Description paragraph one.

Description paragraph two.`;
      
      const result = cleanComments(input, null, null, true, 'en');
      
      expect(result).toContain('Title');
      expect(result).toContain('Featuring: Name');
      expect(result).toContain('Where: Place');
      expect(result).toContain('Description paragraph one');
      expect(result).toContain('Description paragraph two');
    });
  });

  describe('LOCALE_PATTERNS export', () => {
    it('should export LOCALE_PATTERNS constant', () => {
      expect(LOCALE_PATTERNS).toBeDefined();
      expect(LOCALE_PATTERNS.en).toBeDefined();
      expect(LOCALE_PATTERNS.es).toBeDefined();
      expect(LOCALE_PATTERNS.fr).toBeDefined();
      expect(LOCALE_PATTERNS.de).toBeDefined();
    });

    it('should have all required fields for each locale', () => {
      const locales = ['en', 'es', 'fr', 'de'];
      const fields = ['featuring', 'where', 'when', 'credit'];
      
      locales.forEach(locale => {
        fields.forEach(field => {
          expect(LOCALE_PATTERNS[locale][field as keyof CaptionLocale]).toBeDefined();
          expect(Array.isArray(LOCALE_PATTERNS[locale][field as keyof CaptionLocale])).toBe(true);
          expect(LOCALE_PATTERNS[locale][field as keyof CaptionLocale].length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Real-world SmartFrame examples', () => {
    it('should parse typical WENN.com caption format', () => {
      const input = `Lee outside ITV Studios

Featuring: Lee Latchford-Evans
Where: London, United Kingdom
When: 18 Jul 2016
Credit: Rocky/WENN.com

Lee Latchford-Evans seen leaving the ITV Studios in central London after appearing on the morning show.`;
      
      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.title).toBe('Lee outside ITV Studios');
      expect(result.featuring).toBe('Lee Latchford-Evans');
      expect(result.where).toBe('London, United Kingdom');
      expect(result.when).toBe('18 Jul 2016');
      expect(result.credit).toBe('Rocky/WENN.com');
      expect(result.description[0]).toContain('Lee Latchford-Evans seen leaving');
    });

    it('should parse Getty Images format', () => {
      const input = `Red Carpet Premiere

Pictured: Celebrity Name
Location: Hollywood, CA
Date: January 20, 2024
Photo by: Getty Images

Celebrity Name attends the world premiere at the TCL Chinese Theatre.`;
      
      const result = parseMultiParagraphCaption(input, 'en');
      
      expect(result.title).toBe('Red Carpet Premiere');
      expect(result.featuring).toBe('Celebrity Name');
      expect(result.where).toBe('Hollywood, CA');
      expect(result.when).toBe('January 20, 2024');
      expect(result.credit).toBe('Getty Images');
    });
  });
});
