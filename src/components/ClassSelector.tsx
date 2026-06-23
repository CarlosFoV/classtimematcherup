
import { useState } from 'react';
import { Class, GroupedClasses } from '../types/schedule';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { CheckCircle, Clock, MapPin, User, Users, ArrowLeft, Search } from 'lucide-react';

interface ClassSelectorProps {
  groupedClasses: GroupedClasses;
  onSelectionChange: (selectedCrns: string[]) => void;
  onGenerateSchedules: () => void;
  onBack: () => void;
}

export function ClassSelector({ groupedClasses, onSelectionChange, onGenerateSchedules, onBack }: ClassSelectorProps) {
  const [selectedCrns, setSelectedCrns] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const updateSelection = (newSelected: string[]) => {
    setSelectedCrns(newSelected);
    onSelectionChange(newSelected);
  };

  const handleSectionToggle = (crn: string, checked: boolean) => {
    updateSelection(
      checked
        ? [...selectedCrns, crn]
        : selectedCrns.filter(c => c !== crn)
    );
  };

  const handleSubjectToggle = (classes: Class[], checked: boolean) => {
    const crns = classes.map(c => c.crn);
    updateSelection(
      checked
        ? Array.from(new Set([...selectedCrns, ...crns]))
        : selectedCrns.filter(c => !crns.includes(c))
    );
  };

  // Filter subjects based on search query
  const filteredSubjects = Object.entries(groupedClasses).filter(([materia]) =>
    materia.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCount = selectedCrns.length;
  const selectedSubjectCount = filteredSubjects.filter(([, classes]) =>
    classes.some(c => selectedCrns.includes(c.crn))
  ).length;
  const getSubjectState = (classes: Class[]): boolean | 'indeterminate' => {
    const selectedInSubject = classes.filter(c => selectedCrns.includes(c.crn)).length;
    if (selectedInSubject === 0) return false;
    if (selectedInSubject === classes.length) return true;
    return 'indeterminate';
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  Seleccionar Materias
                </CardTitle>
                <CardDescription>
                  Elige las materias que quieres incluir en tu horario
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{selectedSubjectCount}</div>
              <div className="text-sm text-muted-foreground">
                {selectedCount} horario{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar materias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid gap-6">
            {filteredSubjects.map(([materia, classes]) => (
              <Card key={materia} className="border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id={materia}
                      checked={getSubjectState(classes)}
                      onCheckedChange={(checked) =>
                        handleSubjectToggle(classes, checked === true)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <CardTitle className="text-lg text-primary">{materia}</CardTitle>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" />
                          {classes.length} secciones disponibles
                        </Badge>
                        {classes.some(c => selectedCrns.includes(c.crn)) && (
                          <Badge variant="default" className="gap-1">
                            {classes.filter(c => selectedCrns.includes(c.crn)).length} seleccionada
                            {classes.filter(c => selectedCrns.includes(c.crn)).length !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {classes.map((cls) => {
                    const isSelected = selectedCrns.includes(cls.crn);
                    return (
                    <label
                      key={cls.crn}
                      htmlFor={`crn-${cls.crn}`}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-muted/30 hover:border-primary/40'
                      }`}
                    >
                      <Checkbox
                        id={`crn-${cls.crn}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleSectionToggle(cls.crn, checked === true)
                        }
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge variant="outline" className="font-mono">
                            CRN: {cls.crn}
                          </Badge>
                          <Badge variant="secondary">
                            {cls.grupo}
                          </Badge>
                          <Badge 
                            variant={cls.modalidad === 'Presencial' ? 'default' : 'outline'}
                            className="gap-1"
                          >
                            {cls.modalidad}
                          </Badge>
                        </div>
                        
                        <div className="grid sm:grid-cols-3 gap-3 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{cls.dias.join(', ')} {cls.horaInicio} - {cls.horaFin}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{cls.aula}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="truncate">{cls.profesor}</span>
                          </div>
                        </div>
                      </div>
                    </label>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
          
          {filteredSubjects.length === 0 && searchQuery && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No se encontraron materias que coincidan con "{searchQuery}"
              </p>
            </div>
          )}
          
          {selectedCount > 0 && (
            <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="font-medium text-primary">
                    {selectedSubjectCount} materia{selectedSubjectCount !== 1 ? 's' : ''} · {selectedCount} horario{selectedCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    El sistema generará todas las combinaciones posibles con los horarios elegidos
                  </p>
                </div>
                
                <Button 
                  onClick={onGenerateSchedules}
                  className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all"
                >
                  Generar Combinaciones
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
