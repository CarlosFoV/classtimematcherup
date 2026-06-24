
import { useState } from 'react';
import { Class, GroupedClasses } from '../types/schedule';
import { parseScheduleSegments } from '../utils/parser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { CheckCircle, Clock, MapPin, User, Users, ArrowLeft, Search, AlertTriangle } from 'lucide-react';

interface ClassSelectorProps {
  groupedClasses: GroupedClasses;
  onSelectionChange: (selectedCrns: string[]) => void;
  onGenerateSchedules: () => void;
  onCompleteSchedule: (crn: string, update: { dias: string[]; horaInicio: string; horaFin: string }) => void;
  onBack: () => void;
}

export function ClassSelector({ groupedClasses, onSelectionChange, onGenerateSchedules, onCompleteSchedule, onBack }: ClassSelectorProps) {
  const [selectedCrns, setSelectedCrns] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCrn, setEditingCrn] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState('');

  const startEditing = (crn: string) => {
    setEditingCrn(crn);
    setEditValue('');
    setEditError('');
  };

  const cancelEditing = () => {
    setEditingCrn(null);
    setEditValue('');
    setEditError('');
  };

  const saveSchedule = (crn: string) => {
    const segments = parseScheduleSegments(editValue);
    if (segments.length === 0) {
      setEditError('Formato no válido. Ej: MoWe 8:30AM - 9:59AM');
      return;
    }
    // Unir todos los días detectados; usar el primer rango horario.
    const dias = Array.from(new Set(segments.flatMap(s => s.dias)));
    onCompleteSchedule(crn, {
      dias,
      horaInicio: segments[0].horaInicio,
      horaFin: segments[0].horaFin,
    });
    cancelEditing();
  };

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
                          : cls.incompleteSchedule
                          ? 'border-amber-500/50 bg-amber-500/5 hover:border-amber-500'
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
                          {cls.incompleteSchedule && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-500 text-amber-600"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Horario incompleto
                            </Badge>
                          )}
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

                        {cls.incompleteSchedule && editingCrn !== cls.crn && (
                          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                            <p className="text-xs text-amber-600">
                              El portal recortó este horario; puede faltar otro día.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 border-amber-500 text-amber-600 hover:bg-amber-500/10"
                              onClick={(e) => {
                                e.preventDefault();
                                startEditing(cls.crn);
                              }}
                            >
                              Completar horario
                            </Button>
                          </div>
                        )}

                        {editingCrn === cls.crn && (
                          <div
                            className="mt-2 space-y-2"
                            onClick={(e) => e.preventDefault()}
                          >
                            <p className="text-xs text-muted-foreground">
                              Escribe el horario completo tal como aparece en el portal (al hacer hover).
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder="Ej: MoWe 8:30AM - 9:59AM"
                                className="h-8 text-sm"
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    saveSchedule(cls.crn);
                                  }}
                                >
                                  Guardar
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    cancelEditing();
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                            {editError && (
                              <p className="text-xs text-destructive">{editError}</p>
                            )}
                          </div>
                        )}
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
