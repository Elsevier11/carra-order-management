import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

type RichCommand = 'bold' | 'italic' | 'underline';

@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [],
  template: `
    <div class="note-editor" [class.note-editor--disabled]="disabled">
      @if (!disabled) {
        <div class="note-editor__toolbar">
          <button type="button" class="note-editor__btn" (click)="apply('bold')" title="Grassetto"><strong>B</strong></button>
          <button type="button" class="note-editor__btn" (click)="apply('italic')" title="Corsivo"><em>I</em></button>
          <button type="button" class="note-editor__btn" (click)="apply('underline')" title="Sottolineato"><u>U</u></button>
        </div>
      }

      <div
        #editor
        class="note-editor__surface"
        contenteditable="true"
        role="textbox"
        [attr.aria-label]="placeholder"
        [attr.data-placeholder]="placeholder"
        [style.min-height.px]="minHeight"
        [class.note-editor__surface--disabled]="disabled"
        (input)="onInput()"
        (blur)="onBlur()"
        (paste)="onPaste($event)"
      ></div>
    </div>
  `,
  styleUrl: './note-editor.component.scss',
})
export class NoteEditorComponent implements AfterViewInit {
  @Input() placeholder = 'Nota';
  @Input() disabled = false;
  @Input() minHeight = 96;
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('editor') private editorRef?: ElementRef<HTMLDivElement>;

  ngAfterViewInit(): void {
    this.setDisabledState(this.disabled);
    this.writeValue(this.value);
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
    const editor = this.editorRef?.nativeElement;
    if (editor && editor.innerHTML !== this.value) {
      editor.innerHTML = this.value;
    }
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    const editor = this.editorRef?.nativeElement;
    if (editor) {
      editor.contentEditable = String(!isDisabled);
    }
  }

  apply(command: RichCommand): void {
    if (this.disabled) return;
    const editor = this.editorRef?.nativeElement;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false);
    this.syncValue();
  }

  onInput(): void {
    this.syncValue();
  }

  onBlur(): void {
  }

  onPaste(event: ClipboardEvent): void {
    if (this.disabled) return;
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
    this.syncValue();
  }

  private syncValue(): void {
    const editor = this.editorRef?.nativeElement;
    if (!editor) return;
    const text = (editor.textContent ?? '').replace(/\u00a0/g, ' ').trim();
    const html = text ? editor.innerHTML : '';
    this.value = html;
    this.valueChange.emit(html);
  }
}
