import { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { FileText, Sparkles } from 'lucide-react';
import heroImage from '../assets/schedule-hero.jpg';
import exampleText from '../data/exampleSchedule.txt?raw';

interface TextInputProps {
  onTextParsed: (text: string) => void;
}

export function TextInput({ onTextParsed }: TextInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim()) {
      onTextParsed(text);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Hero Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${heroImage})`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/85 to-primary/20" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 container max-w-4xl mx-auto py-12 px-4">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-primary-glow to-secondary bg-clip-text text-transparent">
            Generador de Horarios UP
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Optimiza tu horario universitario de manera inteligente. 
            Importa tus materias y genera las mejores combinaciones posibles.
          </p>
        </div>
        
        <Card className="backdrop-blur-md bg-card/80 border-primary/20 shadow-2xl">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-xl">
                Paso 1: Importar Datos
              </CardTitle>
            </div>
            <CardDescription className="text-base">
              Pega aquí el texto copiado desde el portal universitario para generar tu horario óptimo
            </CardDescription>
          </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="schedule-text" className="text-sm font-medium">
              Texto del Portal Universitario
            </label>
            <Textarea
              id="schedule-text"
              placeholder="Pega aquí el texto copiado del portal..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-48 font-mono text-sm"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleSubmit} 
              disabled={!text.trim()}
              className="flex-1 bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-all"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Procesar Horarios
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setText(exampleText)}
              className="flex-1"
            >
              Usar Ejemplo
            </Button>
          </div>
          
          {text.trim() && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                ✓ Texto listo para procesar ({text.split('\n').filter(l => l.trim()).length} líneas)
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
