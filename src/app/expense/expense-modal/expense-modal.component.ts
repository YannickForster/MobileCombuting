import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { filter, finalize, from, mergeMap, tap } from 'rxjs';
import { CategoryModalComponent } from '../../category/category-modal/category-modal.component';
import { ActionSheetService } from '../../shared/service/action-sheet.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ExpenseService } from '../expense.service';
import { ToastService } from '../../shared/service/toast.service';
import { Category, Expense } from '../../shared/domain';
import { CategoryService } from '../../category/category.service';
import { formatISO, parseISO } from 'date-fns';

@Component({
  selector: 'app-expense-modal',
  templateUrl: './expense-modal.component.html',
})
export class ExpenseModalComponent implements OnInit {
  ngOnInit() {
    const { id, amount, category, date, name } = this.expense;
    if (category) this.categories.push(category);
    if (id) this.expenseForm.patchValue({ id, amount, categoryId: category?.id, date, name });
  }
  readonly expenseForm: FormGroup;
  submitting = false;
  categories: Category[] = [];
  expense: Expense = {} as Expense;
  constructor(
    private readonly actionSheetService: ActionSheetService,
    private readonly expenseService: ExpenseService,
    private readonly formBuilder: FormBuilder,
    private readonly modalCtrl: ModalController,
    private readonly categoryService: CategoryService,
    private readonly toastService: ToastService,
  ) {
    this.expenseForm = this.formBuilder.group({
      id: [], // hidden
      name: ['', [Validators.required, Validators.maxLength(40)]],
      categoryId: [],
      date: [new Date().toISOString()],
      amount: [],
    });
  }

  cancel(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  save(): void {
    this.submitting = true;
    const expenseData = {
      ...this.expenseForm.value,
      date: formatISO(parseISO(this.expenseForm.value.date), { representation: 'date' }),
    };

    this.expenseService
      .upsertExpense(expenseData)
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.toastService.displaySuccessToast('Category saved');
          this.modalCtrl.dismiss(null, 'refresh');
        },
        error: (error) => this.toastService.displayErrorToast('Could not save expense', error),
      });
  }

  delete(): void {
    from(this.actionSheetService.showDeletionConfirmation('Are you sure you want to delete this expense?'))
      .pipe(
        filter((action) => action === 'delete'),
        tap(() => (this.submitting = true)),
        mergeMap(() => this.expenseService.deleteExpense(this.expense.id!)),
        finalize(() => (this.submitting = false)),
      )
      .subscribe({
        next: () => {
          this.toastService.displaySuccessToast('Expense delted');
          this.modalCtrl.dismiss(null, 'refresh');
        },
        error: (error) => this.toastService.displayErrorToast('Could not delete expense', error),
      });
  }

  async showCategoryModal(): Promise<void> {
    const CategoryModal = await this.modalCtrl.create({ component: CategoryModalComponent });
    await CategoryModal.present();
    const { role } = await CategoryModal.onWillDismiss();
    if (role === 'refresh') this.loadAllCategories();
    console.log('role', role);
  }
  private loadAllCategories(): void {
    this.categoryService.getAllCategories({ sort: 'name,asc' }).subscribe({
      next: (categories) => (this.categories = categories),
      error: (error) => this.toastService.displayErrorToast('Could not load expense', error),
    });
  }
  ionViewWillEnter(): void {
    this.loadAllCategories();
  }
}
