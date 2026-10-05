import {test,expect} from '@playwright/test';
for(const width of [360,390,768,1440])test(`task board fits ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/todo');
  const board=page.locator('yuvomi-task-board');await expect(board.locator('.group')).toHaveText('Home · 1');
  await expect(board.getByRole('button',{name:'New task',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width<=650){await expect(board.locator('.filter-fields')).toBeHidden();await board.getByText('Filters and sorting',{exact:true}).click();await expect(board.getByRole('combobox',{name:'Priority',exact:true})).toBeVisible();}
  await board.getByRole('button',{name:'Collapse lists',exact:true}).click();
  const layout=page.locator('ha-two-pane-top-app-bar-fixed');await expect(layout).toHaveCSS('--sidepane-width','48px');
  expect(await page.evaluate(()=>localStorage.getItem('yuvomi-compact-lists'))).toBe('true');
  if(width>650){await expect(page.locator('ha-list ha-dropdown-item').first()).toHaveAttribute('title','Yuvomi Tasks');await expect(page.locator('ha-list ha-dropdown-item').first().locator('[part=label]')).toBeHidden();await expect(page.locator('ha-list span[slot=icon]').first()).toBeVisible();const rail=await page.locator('ha-list').boundingBox();const icon=await page.locator('ha-list span[slot=icon]').first().boundingBox();expect(Math.abs(icon.x+icon.width/2-(rail.x+rail.width/2))).toBeLessThan(1);}
  await board.locator('.task .body button').first().click();await expect(board.locator('.comments')).toContainText('A sample comment');
  if(width<=650){await expect(board.locator('.list')).toBeHidden();await expect(board.getByRole('button',{name:'Back to tasks',exact:true})).toBeVisible();}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`../dist/browser-${width}.png`,fullPage:true});
  if(width<=650){await board.getByRole('button',{name:'Back to tasks',exact:true}).click();await expect(board.locator('.list')).toBeVisible();}
  await page.reload();await expect(page.locator('yuvomi-task-board').getByRole('button',{name:'Expand lists',exact:true})).toBeVisible();
});
